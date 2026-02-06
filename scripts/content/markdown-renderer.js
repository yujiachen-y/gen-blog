import path from 'node:path';
import { createMarkdownRenderer } from './markdown.js';
import { preprocessObsidianContent } from '../obsidian.js';
import { buildPictureHtml } from './pages.js';
import { escapeHtml } from '../shared/templates.js';
import { slugifyHeading } from '../shared/paths.js';
import {
  decodeUriSafe,
  isExternalAsset,
  isRemoteAsset,
  resolveLocalAsset,
} from '../media/asset-resolver.js';
import { resolveImageFromIndex } from '../media/image-index.js';

const applyCalloutTokens = (tokens) => {
  const calloutPattern = /^\[!(\w+)\]\s*/;
  tokens.forEach((token, index) => {
    if (token.type !== 'blockquote_open') {
      return;
    }
    const inlineToken = tokens[index + 2];
    if (!inlineToken || inlineToken.type !== 'inline') {
      return;
    }
    const match = inlineToken.content.match(calloutPattern);
    if (!match) {
      return;
    }
    const type = match[1].toLowerCase();
    const markerLength = match[0].length;
    const existingClass = token.attrGet('class');
    token.attrSet(
      'class',
      existingClass ? `${existingClass} callout callout-${type}` : `callout callout-${type}`
    );
    inlineToken.content = inlineToken.content.slice(markerLength);
    if (inlineToken.children && inlineToken.children.length > 0) {
      let remaining = markerLength;
      inlineToken.children.forEach((child) => {
        if (remaining <= 0 || child.type !== 'text') {
          return;
        }
        const { content } = child;
        if (content.length <= remaining) {
          remaining -= content.length;
          child.content = '';
          return;
        }
        child.content = content.slice(remaining);
        remaining = 0;
      });
      const hasContent = inlineToken.children.some(
        (child) => child.content && child.content.trim()
      );
      if (!hasContent) {
        inlineToken.children = [
          {
            type: 'text',
            content: type.toUpperCase(),
            level: inlineToken.level,
          },
        ];
        inlineToken.content = type.toUpperCase();
      }
    }
  });
};

const getHeadingLevel = (token) => {
  if (token.type !== 'heading_open') {
    return null;
  }
  const level = Number(token.tag.replace('h', ''));
  return Number.isFinite(level) && level >= 1 && level <= 4 ? level : null;
};

const getHeadingInlineToken = (tokens, index) => {
  const inline = tokens[index + 1];
  if (!inline || inline.type !== 'inline') {
    return null;
  }
  return inline;
};

const getHeadingText = (inlineToken) => {
  const rawText = (inlineToken.children || [])
    .map((child) => (child.type === 'text' || child.type === 'code_inline' ? child.content : ''))
    .join('')
    .trim();
  const text = rawText.replace(/%+/g, '').trim();
  return text || null;
};

const getHeadingId = ({ text, toc, headingCounts }) => {
  const baseId = slugifyHeading(text) || `section-${toc.length + 1}`;
  const nextCount = (headingCounts.get(baseId) || 0) + 1;
  headingCounts.set(baseId, nextCount);
  return nextCount === 1 ? baseId : `${baseId}-${nextCount}`;
};

const appendTocHeading = ({ tokens, index, toc, headingCounts }) => {
  const token = tokens[index];
  const level = getHeadingLevel(token);
  const inlineToken = getHeadingInlineToken(tokens, index);
  if (!level || !inlineToken) {
    return;
  }
  const text = getHeadingText(inlineToken);
  if (!text) {
    return;
  }
  const id = getHeadingId({ text, toc, headingCounts });
  token.attrSet('id', id);
  toc.push({ level, id, text });
};

export const renderMarkdownWithImages = async ({
  content,
  filePath,
  imageCache,
  imageOptions,
  imageIndex,
  buildImagePath,
  allowRemoteImages,
  processImageTask,
  processImageSourceTask,
  inputDir,
  imageExts,
  pathExists,
}) => {
  const renderer = createMarkdownRenderer({ allowHtml: false });
  const { md } = renderer;
  const env = {};
  const processedContent = await preprocessObsidianContent({
    source: content,
    filePath,
    imageIndex,
    inputDir,
    imageExts,
    pathExists,
    resolveImageFromIndex,
  });
  const tokens = md.parse(processedContent, env);
  applyCalloutTokens(tokens);

  const toc = [];
  const headingCounts = new Map();
  tokens.forEach((_, idx) => appendTocHeading({ tokens, index: idx, toc, headingCounts }));

  const collectImageTokens = (tokenList) =>
    tokenList.flatMap((token) => {
      const nested = token.children ? collectImageTokens(token.children) : [];
      return token.type === 'image' ? [token, ...nested] : nested;
    });

  const imageSources = collectImageTokens(tokens)
    .map((token) => token.attrGet('src'))
    .filter(Boolean);

  const imagePathMap = new Map();
  let imageCounter = 0;
  imageSources.forEach((src) => {
    if (!imagePathMap.has(src)) {
      imageCounter += 1;
      imagePathMap.set(src, buildImagePath(imageCounter));
    }
  });

  const resolvedImages = await Promise.all(
    imageSources.map(async (src) => {
      const relativePath = imagePathMap.get(src);
      if (isExternalAsset(src)) {
        if (isRemoteAsset(src) && !allowRemoteImages) {
          throw new Error(`${filePath}: remote images are disabled (${src})`);
        }
        const cacheKey = `external:${relativePath}:${src}`;
        if (!imageCache.has(cacheKey)) {
          imageCache.set(
            cacheKey,
            (async () => {
              try {
                return {
                  ...(await processImageSourceTask(src, { ...imageOptions, relativePath })),
                  external: false,
                };
              } catch (error) {
                return { picture: null, external: true };
              }
            })()
          );
        }
        const processed = await imageCache.get(cacheKey);
        return { src, picture: processed.picture, external: processed.external };
      }

      const normalizedSrc = decodeUriSafe(src);
      const resolved =
        resolveLocalAsset({ src: normalizedSrc, filePath, inputDir }) ||
        resolveImageFromIndex(path.basename(normalizedSrc), filePath, imageIndex);
      if (!resolved) {
        throw new Error(`${filePath}: image must live under vault (${src})`);
      }
      const ext = path.extname(resolved).toLowerCase();
      if (!imageExts.has(ext)) {
        throw new Error(`${filePath}: unsupported image format ${ext} in ${src}`);
      }
      const cacheKey = `${resolved}:${relativePath}`;
      if (!imageCache.has(cacheKey)) {
        imageCache.set(cacheKey, processImageTask(resolved, { ...imageOptions, relativePath }));
      }
      const processed = await imageCache.get(cacheKey);
      return { src, picture: processed.picture, external: false };
    })
  );

  const imageMap = new Map(resolvedImages.map((entry) => [entry.src, entry]));

  md.renderer.rules.image = (tokenList, idx) => {
    const token = tokenList[idx];
    const src = token.attrGet('src') || '';
    const alt = token.content || '';
    const entry = imageMap.get(src);
    if (entry && entry.picture) {
      return buildPictureHtml(entry.picture, { alt, imgClass: 'article-image' });
    }
    if (entry && entry.external) {
      const title = token.attrGet('title');
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr} />`;
    }
    return '';
  };

  return { html: md.renderer.render(tokens, md.options, env), toc };
};
