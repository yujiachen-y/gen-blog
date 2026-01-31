import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { createMarkdownRenderer } from './markdown.js';
import { processImage, processImageSource } from './images.js';
import { subsetThemeFonts } from './fonts.js';
import { THEME_CONSTANTS } from '../theme.constants.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: npm run generate -- <markdownDir> [outputDir] [--site-url <url>]');
  process.exit(1);
}

const getArgValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  if (index === -1) {
    return fallback;
  }
  const value = args[index + 1];
  return value ?? fallback;
};

const inputArg = args[0];
const outputArg = args[1] && !args[1].startsWith('--') ? args[1] : 'dist';

const inputDir = path.resolve(inputArg);
const outputDir = path.resolve(outputArg);
const themeDir = path.resolve('theme');
const SUPPORTED_LANGS = new Set(['zh', 'en']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png']);

const slugifySegment = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const slugifyPath = (value) =>
  value
    .split(/[\\/]+/)
    .map(slugifySegment)
    .filter(Boolean)
    .join('/');

const slugifyHeading = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

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

const formatDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
};

const ensureDir = (dir) => fs.mkdir(dir, { recursive: true });

const writeFile = (filePath, data) => fs.writeFile(filePath, data, 'utf8');

const writeJson = (filePath, data) =>
  fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const pathExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
};

const readTemplate = async (fileName) => fs.readFile(path.join(themeDir, fileName), 'utf8');

const resolveConfigDir = async (rootDir) => {
  const configDir = path.join(rootDir, '.blog');
  if (await pathExists(path.join(configDir, 'blog.config.json'))) {
    return configDir;
  }
  if (await pathExists(path.join(rootDir, 'blog.config.json'))) {
    return rootDir;
  }
  return configDir;
};

const normalizeStringList = (value, fieldName) => {
  if (value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
    return [trimmed];
  }
  if (Array.isArray(value)) {
    const list = value.map((item) => String(item || '').trim());
    if (list.length === 0 || list.some((item) => !item)) {
      throw new Error(`${fieldName} must be a non-empty string or array of non-empty strings`);
    }
    return list;
  }
  throw new Error(`${fieldName} must be a non-empty string or array of strings`);
};

const readSiteConfig = async (configDir) => {
  const configPath = path.join(configDir, 'blog.config.json');
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('blog.config.json must be a JSON object');
    }
    const siteTitle = parsed.siteTitle === undefined ? null : String(parsed.siteTitle || '').trim();
    if (parsed.siteTitle !== undefined && !siteTitle) {
      throw new Error('blog.config.json: siteTitle must be a non-empty string');
    }
    const siteUrl = parsed.siteUrl === undefined ? null : String(parsed.siteUrl || '').trim();
    if (parsed.siteUrl !== undefined && !siteUrl) {
      throw new Error('blog.config.json: siteUrl must be a non-empty string');
    }
    const allowRemoteImages =
      parsed.allowRemoteImages === undefined ? false : parsed.allowRemoteImages;
    if (parsed.allowRemoteImages !== undefined && typeof allowRemoteImages !== 'boolean') {
      throw new Error('blog.config.json: allowRemoteImages must be a boolean');
    }
    const fontCssUrls =
      parsed.fontCssUrls === undefined
        ? null
        : normalizeStringList(parsed.fontCssUrls, 'blog.config.json: fontCssUrls');
    return { siteTitle, siteUrl, allowRemoteImages, fontCssUrls };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { siteTitle: null, siteUrl: null, allowRemoteImages: false, fontCssUrls: null };
    }
    throw error;
  }
};

const renderTemplate = (template, values) =>
  Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value ?? '')),
    template
  );

const buildFontLinks = (urls) => {
  if (!urls || urls.length === 0) {
    return '';
  }
  const links = [];
  if (urls.some((url) => url.includes('fonts.googleapis.com'))) {
    links.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
    links.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
  }
  urls.forEach((url) => {
    links.push(`<link rel="stylesheet" href="${escapeHtml(url)}" />`);
  });
  return links.join('\n');
};

const buildIconLinks = (icons) =>
  icons
    .map((icon) => {
      const attrs = [
        `rel="${escapeHtml(icon.rel)}"`,
        `href="${escapeHtml(icon.href)}"`,
        icon.type ? `type="${escapeHtml(icon.type)}"` : null,
        icon.sizes ? `sizes="${escapeHtml(icon.sizes)}"` : null,
      ]
        .filter(Boolean)
        .join(' ');
      return `<link ${attrs} />`;
    })
    .join('\n');

const resolveThemeAssets = async (configDir) => {
  const themeConfigDir = path.join(configDir, 'theme');
  const iconCandidates = await Promise.all(
    THEME_CONSTANTS.icons.map(async (icon) => {
      const sourcePath = path.join(themeConfigDir, icon.href);
      if (!(await pathExists(sourcePath))) {
        return null;
      }
      return {
        ...icon,
        href: `/${icon.href}`,
        sourcePath,
      };
    })
  );
  const icons = iconCandidates.filter(Boolean);
  const fontsCssPath = path.join(themeConfigDir, THEME_CONSTANTS.assets.fontsCss);
  const fontsDir = path.join(themeConfigDir, THEME_CONSTANTS.assets.fontsDir);
  return {
    themeConfigDir,
    icons,
    fontsCssPath: (await pathExists(fontsCssPath)) ? fontsCssPath : null,
    fontsDir: (await pathExists(fontsDir)) ? fontsDir : null,
  };
};

const normalizeLanguage = (value) => {
  if (!value) {
    return null;
  }
  const raw = String(value).toLowerCase().trim();
  if (raw === 'zh' || raw.startsWith('zh-')) {
    return 'zh';
  }
  if (raw === 'en' || raw.startsWith('en-')) {
    return 'en';
  }
  return null;
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripLeadingSlash = (value) => (value.startsWith('/') ? value.slice(1) : value);

const BASE_FONT_CHARS =
  `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789` +
  ` .,;:!?"'` +
  '`' +
  `“”‘’` +
  `()[]{}<>+-=_/\\|@#$%^&*~`;
const UI_FONT_TEXT = THEME_CONSTANTS.uiText.join(' ');

const collectFontText = (posts, siteTitle) => {
  const parts = [BASE_FONT_CHARS, UI_FONT_TEXT, siteTitle || ''];
  posts.forEach((post) => {
    if (post.title) {
      parts.push(post.title);
    }
    if (post.excerpt) {
      parts.push(post.excerpt);
    }
    if (post.date) {
      parts.push(post.date);
    }
    if (post.category && Array.isArray(post.category)) {
      parts.push(post.category.join(' '));
    }
    if (post.content) {
      parts.push(post.content);
    }
  });
  return parts.join('');
};

const buildPostAssetDir = (post) =>
  path.posix.join('posts', post.translationKey, post.lang || post.defaultLang || 'unknown');

const buildPostImagePath = (post, index) =>
  path.posix.join(buildPostAssetDir(post), `image_${index}`);

const buildPostCoverPath = (post) => path.posix.join(buildPostAssetDir(post), 'cover');

const shouldIgnoreDir = (entryName) => entryName.startsWith('.') || entryName === 'node_modules';

const collectMarkdownFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (shouldIgnoreDir(entry.name)) {
          return [];
        }
        return collectMarkdownFiles(fullPath);
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        return [fullPath];
      }
      return [];
    })
  );

  return nested.flat();
};

const collectImageFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (shouldIgnoreDir(entry.name)) {
          return [];
        }
        return collectImageFiles(fullPath);
      }
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTS.has(ext)) {
          return [fullPath];
        }
      }
      return [];
    })
  );

  return nested.flat();
};

const addToIndex = (index, key, filePath) => {
  if (!key) {
    return;
  }
  const normalized = key.toLowerCase();
  const list = index.get(normalized) || [];
  list.push(filePath);
  index.set(normalized, list);
};

const buildImageIndex = async (dir) => {
  const files = await collectImageFiles(dir);
  const index = new Map();
  files.forEach((filePath) => {
    const base = path.basename(filePath);
    const name = path.parse(base).name;
    addToIndex(index, base, filePath);
    addToIndex(index, name, filePath);
  });
  return index;
};

const resolveImageFromIndex = (name, filePath, imageIndex) => {
  if (!name) {
    return null;
  }
  const matches = imageIndex.get(name.toLowerCase()) || [];
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    throw new Error(`${filePath}: ambiguous Obsidian image "${name}" matches multiple files`);
  }
  return null;
};

const shouldPreserveOutput = async (dir) => {
  if (!(await pathExists(dir))) {
    return false;
  }
  const markers = ['.git', 'CNAME', '.nojekyll'];
  const hits = await Promise.all(markers.map((marker) => pathExists(path.join(dir, marker))));
  return hits.some(Boolean);
};

const syncDirectory = async (sourceDir, targetDir, preserve = new Set()) => {
  await ensureDir(targetDir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      if (entry.isDirectory()) {
        await syncDirectory(srcPath, targetPath);
        return;
      }
      if (entry.isFile()) {
        await fs.copyFile(srcPath, targetPath);
      }
    })
  );

  const targetEntries = await fs.readdir(targetDir, { withFileTypes: true });
  const sourceNames = new Set(entries.map((entry) => entry.name));
  await Promise.all(
    targetEntries.map(async (entry) => {
      if (preserve.has(entry.name) || sourceNames.has(entry.name)) {
        return;
      }
      await fs.rm(path.join(targetDir, entry.name), { recursive: true, force: true });
    })
  );
};

const resolveTranslationKey = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }
  const slugged = slugifyPath(raw);
  if (!slugged || slugged !== raw) {
    return null;
  }
  return raw;
};

const normalizeCategories = (value) => {
  if (!Array.isArray(value)) {
    return null;
  }
  const categories = value.map((item) => String(item || '').trim()).filter(Boolean);
  return categories.length > 0 ? categories : null;
};

const toPosixPath = (value) => value.split(path.sep).join('/');

const decodeUriSafe = (value) => {
  try {
    return decodeURI(value);
  } catch (error) {
    return value;
  }
};

const isRemoteAsset = (src) => /^https?:\/\//i.test(src);
const isDataAsset = (src) => src.startsWith('data:');
const isExternalAsset = (src) => isRemoteAsset(src) || isDataAsset(src);

const resolveLocalAsset = (src, filePath) => {
  if (!src) {
    return null;
  }

  const trimmed = src.startsWith('/') ? src.slice(1) : src;
  const resolved = src.startsWith('/')
    ? path.join(inputDir, trimmed)
    : path.resolve(path.dirname(filePath), trimmed);
  const relative = path.relative(inputDir, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return resolved;
};

const convertHtmlAsidesToCallouts = (value) => {
  const lines = value.split('\n');
  const output = [];
  let inAside = false;
  let asideLines = [];
  let inFence = false;
  let fenceToken = '';

  const flushAside = () => {
    const normalized = asideLines.map((line) => line.replace(/\r$/, ''));
    asideLines = [];
    inAside = false;

    let start = 0;
    let end = normalized.length;
    while (start < end && normalized[start].trim() === '') {
      start += 1;
    }
    while (end > start && normalized[end - 1].trim() === '') {
      end -= 1;
    }
    const body = normalized.slice(start, end);
    if (body.length === 0) {
      output.push('> [!note]');
      return;
    }
    const title = body[0].trim();
    output.push(title ? `> [!note] ${title}` : '> [!note]');
    body.slice(1).forEach((line) => {
      if (line.trim() === '') {
        output.push('>');
        return;
      }
      output.push(`> ${line}`);
    });
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(?:```|~~~)/);
    if (!inAside && fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceToken = fenceMatch[0];
      } else if (trimmed.startsWith(fenceToken)) {
        inFence = false;
      }
      output.push(line);
      return;
    }

    if (!inAside && inFence) {
      output.push(line);
      return;
    }

    if (inAside) {
      const lower = line.toLowerCase();
      const endIndex = lower.indexOf('</aside>');
      if (endIndex === -1) {
        asideLines.push(line);
        return;
      }
      asideLines.push(line.slice(0, endIndex));
      flushAside();
      const after = line.slice(endIndex + 8);
      if (after.trim()) {
        output.push(after);
      }
      return;
    }

    const lower = line.toLowerCase();
    const startIndex = lower.indexOf('<aside');
    if (startIndex === -1) {
      output.push(line);
      return;
    }
    const tagEnd = lower.indexOf('>', startIndex);
    if (tagEnd === -1) {
      output.push(line);
      return;
    }
    const before = line.slice(0, startIndex);
    if (before.trim()) {
      output.push(before);
    }
    const afterTag = line.slice(tagEnd + 1);
    const afterLower = afterTag.toLowerCase();
    const endIndex = afterLower.indexOf('</aside>');
    if (endIndex !== -1) {
      asideLines.push(afterTag.slice(0, endIndex));
      flushAside();
      const after = afterTag.slice(endIndex + 8);
      if (after.trim()) {
        output.push(after);
      }
      return;
    }
    inAside = true;
    asideLines.push(afterTag);
  });

  if (inAside) {
    flushAside();
  }

  return output.join('\n');
};

const stripObsidianComments = (value) => {
  const lines = value.split('\n');
  const output = [];
  let inBlock = false;
  let inFence = false;
  let fenceToken = '';

  lines.forEach((line) => {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(?:```|~~~)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceToken = fenceMatch[0];
      } else if (trimmed.startsWith(fenceToken)) {
        inFence = false;
      }
      output.push(line);
      return;
    }

    if (inFence) {
      output.push(line);
      return;
    }

    let cursor = 0;
    let buffer = '';

    while (cursor < line.length) {
      const idx = line.indexOf('%%', cursor);
      if (idx === -1) {
        if (!inBlock) {
          buffer += line.slice(cursor);
        }
        break;
      }

      if (!inBlock) {
        buffer += line.slice(cursor, idx);
        inBlock = true;
      } else {
        inBlock = false;
      }

      cursor = idx + 2;
    }

    output.push(buffer);
  });

  return output
    .join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[ \t]*#{1,6}[ \t]*$/gm, '');
};

const stripObsidianDeletions = (value) => {
  const lines = value.split('\n');
  const output = [];
  let inDeletion = false;
  let inFence = false;
  let fenceToken = '';

  lines.forEach((line) => {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(?:```|~~~)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceToken = fenceMatch[0];
      } else if (trimmed.startsWith(fenceToken)) {
        inFence = false;
      }
      output.push(line);
      return;
    }

    if (inFence) {
      output.push(line);
      return;
    }

    let cursor = 0;
    let buffer = '';
    while (cursor < line.length) {
      const idx = line.indexOf('~~', cursor);
      if (idx === -1) {
        if (!inDeletion) {
          buffer += line.slice(cursor);
        }
        break;
      }

      if (!inDeletion) {
        buffer += line.slice(cursor, idx);
        inDeletion = true;
      } else {
        inDeletion = false;
      }
      cursor = idx + 2;
    }
    output.push(buffer);
  });

  return output.join('\n');
};

const isObsidianSizeHint = (value) => /^\d+(x\d+)?$/i.test(value);

const resolveEmbedPath = async (target, filePath, imageIndex) => {
  const normalizedTarget = target.replace(/^\/+/, '');
  const ext = path.extname(normalizedTarget).toLowerCase();
  if (ext && !IMAGE_EXTS.has(ext)) {
    throw new Error(`${filePath}: unsupported image format ${ext} in Obsidian embed`);
  }

  const hasPath = normalizedTarget.includes('/') || normalizedTarget.includes('\\');
  const candidates = [];
  if (hasPath) {
    candidates.push(path.resolve(path.dirname(filePath), normalizedTarget));
    candidates.push(path.resolve(inputDir, normalizedTarget));
  } else {
    candidates.push(path.resolve(path.dirname(filePath), normalizedTarget));
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return resolveImageFromIndex(path.basename(normalizedTarget), filePath, imageIndex);
};

const replaceObsidianImageEmbeds = async (source, filePath, imageIndex) => {
  const embeds = [];
  const pattern = /!\[\[([\s\S]+?)\]\]/g;
  let match = pattern.exec(source);
  while (match) {
    embeds.push({ raw: match[0], inner: match[1] });
    match = pattern.exec(source);
  }

  if (embeds.length === 0) {
    return source;
  }

  let output = source;
  for (const embed of embeds) {
    const parts = embed.inner.split('|').map((part) => part.trim());
    let target = parts.shift() || '';
    const anchorIndex = target.indexOf('#');
    if (anchorIndex !== -1) {
      target = target.slice(0, anchorIndex);
    }
    target = target.trim();
    if (!target) {
      throw new Error(`${filePath}: empty Obsidian embed`);
    }

    const alt = parts.find((part) => part && !isObsidianSizeHint(part)) || '';
    const resolved = await resolveEmbedPath(target, filePath, imageIndex);
    if (!resolved) {
      throw new Error(`${filePath}: unresolved Obsidian image "${target}"`);
    }
    const relative = toPosixPath(path.relative(path.dirname(filePath), resolved));
    const encoded = encodeURI(relative);
    const replacement = `![${alt}](${encoded})`;
    output = output.replace(embed.raw, replacement);
  }

  return output;
};

const preprocessObsidianContent = async (source, filePath, imageIndex) => {
  const withAsides = convertHtmlAsidesToCallouts(source);
  const stripped = stripObsidianComments(withAsides);
  const cleaned = stripObsidianDeletions(stripped);
  return replaceObsidianImageEmbeds(cleaned, filePath, imageIndex);
};

const buildPictureHtml = (picture, options = {}) => {
  if (!picture) {
    return '';
  }

  const { alt = '', pictureClass = '', imgClass = '', loading = null } = options;
  const altText = escapeHtml(alt);
  const width = picture.img.width ? ` width="${picture.img.width}"` : '';
  const height = picture.img.height ? ` height="${picture.img.height}"` : '';
  const loadingAttr = loading ? ` loading="${loading}"` : '';
  const pictureClassAttr = pictureClass ? ` class="${pictureClass}"` : '';
  const imgClassAttr = imgClass ? ` class="${imgClass}"` : '';

  return `\n<picture${pictureClassAttr}>\n  <source srcset="${picture.sources[0].src}" type="${picture.sources[0].type}" />\n  <img src="${picture.img.src}" alt="${altText}"${imgClassAttr}${width}${height}${loadingAttr} />\n</picture>\n`;
};

const buildArticleHtml = (post) => {
  const coverHtml = post.coverPicture
    ? `\n<div class="article-cover">${buildPictureHtml(post.coverPicture, {
        alt: post.title,
        imgClass: 'article-cover-image',
      })}<div class="article-cover-overlay"></div></div>\n`
    : '';

  const categoryLabel = post.categories.map((cat) => cat.toUpperCase()).join(' · ');

  return `\n${coverHtml}\n<div class="article-text-content">\n  <div class="article-date">${escapeHtml(post.date)} · ${escapeHtml(
    categoryLabel
  )}</div>\n  <h1 class="article-hero">${escapeHtml(post.title)}</h1>\n  <div class="article-body">${post.contentHtml}</div>\n</div>\n`;
};

const buildTocHtml = (tocItems, lang) => {
  if (!tocItems || tocItems.length === 0) {
    return '';
  }
  const title = lang === 'zh' ? '目录' : 'Contents';
  const items = tocItems
    .map(
      (item) =>
        `\n      <li class="toc-item toc-level-${item.level}"><a href="#${escapeHtml(
          item.id
        )}">${escapeHtml(item.text || item.id)}</a></li>`
    )
    .join('');
  return `\n    <aside class="article-toc" data-toc>\n      <button class="toc-toggle" type="button" data-toc-toggle aria-expanded="false">\n        <span class="toc-toggle-label">${escapeHtml(title)}</span>\n        <span class="toc-toggle-icon" aria-hidden="true">⌄</span>\n      </button>\n      <div class="toc-panel" data-toc-panel>\n        <div class="toc-title">${escapeHtml(title)}</div>\n        <ol class="toc-list">${items}\n        </ol>\n      </div>\n    </aside>\n  `;
};

const formatShortDate = (dateStr) => {
  if (!dateStr || dateStr.length < 10) {
    return dateStr || '';
  }
  return dateStr.slice(5);
};

const buildCardHtml = (post, sortedCategoryNames) => {
  const categoryLabel = post.categories[0] || 'General';
  const catIndex = sortedCategoryNames ? sortedCategoryNames.indexOf(categoryLabel) % 5 : 0;
  const dataCat = catIndex === -1 ? 0 : catIndex;
  const coverHtml = post.coverPicture
    ? buildPictureHtml(post.coverPicture, {
        alt: post.title,
        imgClass: 'card-image',
        loading: 'lazy',
      })
    : '';
  const shortDate = formatShortDate(post.date);

  return `\n<a class="card${post.coverPicture ? ' has-image' : ''}" href="${post.url}">\n  <div class="card-content-wrapper">\n    <div class="card-title" data-cat="${dataCat}" data-category-name="${escapeHtml(categoryLabel)}">${escapeHtml(post.title)}</div>\n    <span class="card-date">${escapeHtml(shortDate)}</span>\n  </div>\n  ${coverHtml}\n</a>\n`;
};

const buildMetaTags = (tags) =>
  tags
    .filter(Boolean)
    .map((tag) => `    ${tag}`)
    .join('\n');

const buildHreflangLinks = (translations) => {
  const entries = Object.entries(translations).map(
    ([lang, url]) => `<link rel="alternate" hreflang="${lang}" href="${url}" />`
  );
  return entries.join('\n');
};

const buildCanonical = (url) => `<link rel="canonical" href="${url}" />`;

const buildMetaForPost = (post, siteTitle, canonicalUrl, hreflangLinks, baseUrl) => {
  const description = escapeHtml(post.excerpt);
  const title = escapeHtml(`${post.title} | ${siteTitle}`);
  const ogImageSrc = post.coverPicture?.img?.src
    ? buildUrl(baseUrl, post.coverPicture.img.src)
    : null;
  const ogImage = ogImageSrc ? `<meta property="og:image" content="${ogImageSrc}" />` : '';
  const twitterCard = post.coverPicture ? 'summary_large_image' : 'summary';

  return buildMetaTags([
    `<meta name="description" content="${description}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    ogImage,
    `<meta name="twitter:card" content="${twitterCard}" />`,
    buildCanonical(canonicalUrl),
    hreflangLinks,
  ]);
};

const buildMetaForList = (siteTitle, description, canonicalUrl, prevUrl, nextUrl, hreflangLinks) =>
  buildMetaTags([
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:title" content="${escapeHtml(siteTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    buildCanonical(canonicalUrl),
    prevUrl ? `<link rel="prev" href="${prevUrl}" />` : '',
    nextUrl ? `<link rel="next" href="${nextUrl}" />` : '',
    hreflangLinks,
  ]);

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const wrapCdata = (value) =>
  `<![CDATA[${String(value || '').replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;

const formatRssDate = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toUTCString();
};

const makeAbsoluteUrl = (baseUrl, url) => {
  if (!baseUrl || !url) {
    return url;
  }
  if (
    url.startsWith('#') ||
    url.startsWith('data:') ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:') ||
    /^https?:\/\//i.test(url)
  ) {
    return url;
  }
  if (url.startsWith('/')) {
    return buildUrl(baseUrl, url);
  }
  return url;
};

const absolutizeSrcset = (value, baseUrl) =>
  value
    .split(',')
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return null;
      }
      const [url, ...rest] = trimmed.split(/\s+/);
      const absolute = makeAbsoluteUrl(baseUrl, url);
      return [absolute, ...rest].join(' ');
    })
    .filter(Boolean)
    .join(', ');

const replaceAttrValue = (html, attr, baseUrl) => {
  const pattern = new RegExp(`${attr}=(['"])([^'"]+)\\1`, 'gi');
  return html.replace(pattern, (match, quote, value) => {
    const absolute = makeAbsoluteUrl(baseUrl, value);
    return `${attr}=${quote}${absolute}${quote}`;
  });
};

const absolutizeHtml = (value, baseUrl) => {
  if (!baseUrl || !value) {
    return value || '';
  }
  const withAttrs = ['src', 'href', 'poster'].reduce(
    (html, attr) => replaceAttrValue(html, attr, baseUrl),
    String(value)
  );
  return withAttrs.replace(/srcset=(['"])([\s\S]*?)\1/gi, (match, quote, attrValue) => {
    const normalized = absolutizeSrcset(attrValue, baseUrl);
    return `srcset=${quote}${normalized}${quote}`;
  });
};

const formatRssLanguage = (lang) => {
  if (lang === 'zh') {
    return 'zh-CN';
  }
  return 'en';
};

const buildRssLinks = (lang, defaultLang, siteUrl) => {
  if (!siteUrl) {
    return '';
  }
  const defaultHref = buildUrl(siteUrl, '/rss.xml');
  const langHref = buildUrl(siteUrl, `/rss-${lang}.xml`);
  const links = [
    `<link rel="alternate" type="application/rss+xml" title="RSS" href="${escapeHtml(
      defaultHref
    )}" />`,
  ];
  if (lang && lang !== defaultLang) {
    links.push(
      `<link rel="alternate" type="application/rss+xml" title="RSS (${lang.toUpperCase()})" href="${escapeHtml(
        langHref
      )}" />`
    );
  } else if (lang && lang === defaultLang) {
    links.push(
      `<link rel="alternate" type="application/rss+xml" title="RSS (${lang.toUpperCase()})" href="${escapeHtml(
        langHref
      )}" />`
    );
  }
  return links.join('\n');
};

const buildRssFeed = ({ siteTitle, siteUrl, lang, defaultLang, items, feedUrl }) => {
  const channelTitle =
    lang === defaultLang ? siteTitle : `${siteTitle} (${String(lang || '').toUpperCase()})`;
  const channelLink = buildUrl(siteUrl, buildListUrl(lang, defaultLang));
  const language = formatRssLanguage(lang);
  const latestDate = items.reduce((latest, item) => {
    const pubDate = formatRssDate(item.date);
    if (!pubDate) {
      return latest;
    }
    const current = new Date(pubDate);
    if (Number.isNaN(current.getTime())) {
      return latest;
    }
    if (!latest || current > latest) {
      return current;
    }
    return latest;
  }, null);
  const lastBuildDate = latestDate ? latestDate.toUTCString() : new Date().toUTCString();

  const rssItems = items
    .map((post) => {
      const itemUrl = buildUrl(siteUrl, post.url);
      const pubDate = formatRssDate(post.date);
      const categories = (post.categories || [])
        .map((category) => `    <category>${escapeXml(category)}</category>`)
        .join('\n');
      const contentHtml = absolutizeHtml(post.contentHtml || '', siteUrl);
      const contentEncoded = wrapCdata(contentHtml);
      return [
        '  <item>',
        `    <title>${escapeXml(post.title)}</title>`,
        `    <link>${escapeXml(itemUrl)}</link>`,
        `    <guid isPermaLink="true">${escapeXml(itemUrl)}</guid>`,
        pubDate ? `    <pubDate>${escapeXml(pubDate)}</pubDate>` : null,
        categories || null,
        `    <content:encoded>${contentEncoded}</content:encoded>`,
        '  </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    '  <channel>',
    `    <title>${escapeXml(channelTitle)}</title>`,
    `    <link>${escapeXml(channelLink)}</link>`,
    `    <description>${escapeXml(siteTitle)}</description>`,
    `    <language>${escapeXml(language)}</language>`,
    `    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    rssItems,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
};

const loadPosts = async () => {
  const files = await collectMarkdownFiles(inputDir);
  const errors = [];

  const results = await Promise.all(
    files.map(async (filePath) => {
      const raw = await fs.readFile(filePath, 'utf8');
      const { data, content } = matter(raw);
      const fileErrors = [];

      const blogPublish = data.blog_publish;
      if (blogPublish === undefined) {
        return null;
      }
      if (blogPublish !== true && blogPublish !== false) {
        fileErrors.push(`${filePath}: blog_publish must be true or false`);
      }
      if (blogPublish === false) {
        return null;
      }

      const title = data.blog_title ? String(data.blog_title).trim() : '';
      if (!title) {
        fileErrors.push(`${filePath}: missing blog_title`);
      }

      const date = formatDate(data.blog_date);
      if (!date) {
        fileErrors.push(`${filePath}: invalid blog_date`);
      }

      const lang = normalizeLanguage(data.blog_lang);
      if (!lang || !SUPPORTED_LANGS.has(lang)) {
        fileErrors.push(`${filePath}: invalid blog_lang (must be zh or en)`);
      }

      const translationKey = resolveTranslationKey(data.blog_translation_key);
      if (!translationKey) {
        fileErrors.push(`${filePath}: invalid blog_translation_key (use slug/path)`);
      }

      const categories = normalizeCategories(data.blog_category);
      if (!categories) {
        fileErrors.push(`${filePath}: blog_category must be a non-empty list`);
      }

      const excerpt = data.blog_excerpt ? String(data.blog_excerpt).trim() : '';
      if (!excerpt) {
        fileErrors.push(`${filePath}: missing blog_excerpt`);
      }

      const coverImage = data.blog_cover_image ? String(data.blog_cover_image).trim() : null;

      if (fileErrors.length > 0) {
        errors.push(...fileErrors);
        return null;
      }

      return {
        sourcePath: filePath,
        title,
        date,
        lang,
        translationKey,
        categories,
        excerpt,
        coverImage,
        content,
      };
    })
  );

  if (errors.length > 0) {
    throw new Error(`Frontmatter validation failed:\n${errors.join('\n')}`);
  }

  return results.filter(Boolean);
};

const buildPostGroups = (posts) => {
  const grouped = new Map();
  const errors = [];

  posts.forEach((post) => {
    if (!grouped.has(post.translationKey)) {
      grouped.set(post.translationKey, { translationKey: post.translationKey, translations: {} });
    }
    const group = grouped.get(post.translationKey);
    if (group.translations[post.lang]) {
      errors.push(
        `${post.sourcePath}: duplicate translation for ${post.translationKey}/${post.lang}`
      );
      return;
    }
    group.translations[post.lang] = post;
  });

  if (errors.length > 0) {
    throw new Error(`Translation conflicts:\n${errors.join('\n')}`);
  }

  const groups = Array.from(grouped.values()).map((group) => {
    const languages = Object.keys(group.translations);
    const defaultLang = languages.includes('en') ? 'en' : languages[0];
    return {
      ...group,
      languages,
      defaultLang,
    };
  });

  return groups;
};

const buildUrl = (baseUrl, pathName) => {
  if (!baseUrl) {
    return pathName;
  }
  const trimmed = baseUrl.replace(/\/$/, '');
  return `${trimmed}${pathName}`;
};

const LIST_BASE = '/blog';

const buildHomeUrl = (lang, defaultLang) => {
  const prefix = lang === defaultLang ? '' : `/${lang}`;
  return `${prefix}/` || '/';
};

const buildPostUrl = (translationKey, lang, defaultLang) => {
  const langSegment = lang === defaultLang ? '' : `/${lang}`;
  return `/${translationKey}${langSegment}/`;
};

const buildListUrl = (lang, defaultLang) => {
  const langSegment = lang === defaultLang ? '' : `/${lang}`;
  return `${LIST_BASE}${langSegment}/`;
};

const buildListSectionsHtml = (items, sortedCategoryNames) => {
  const groups = [];
  items.forEach((item) => {
    const year = item.date ? item.date.slice(0, 4) : 'Unknown';
    const current = groups[groups.length - 1];
    if (!current || current.year !== year) {
      groups.push({ year, items: [item] });
    } else {
      current.items.push(item);
    }
  });

  return groups
    .map((group) => {
      const cards = group.items.map((item) => buildCardHtml(item, sortedCategoryNames)).join('');
      return `\n<section class="year-section">\n  <h2 class="year-heading">${escapeHtml(
        group.year
      )}</h2>\n  <div class="year-posts">${cards}</div>\n</section>\n`;
    })
    .join('');
};

const buildAboutUrl = (lang, defaultLang, aboutGroup) => {
  if (!aboutGroup) {
    return buildListUrl(lang, defaultLang);
  }
  const targetLang = aboutGroup.languages.includes(lang) ? lang : aboutGroup.defaultLang;
  return buildPostUrl('about', targetLang, aboutGroup.defaultLang);
};

const renderMarkdownWithImages = async ({
  content,
  filePath,
  imageCache,
  imageOptions,
  imageIndex,
  buildImagePath,
  allowRemoteImages,
}) => {
  const renderer = createMarkdownRenderer({ allowHtml: false });
  const { md } = renderer;
  const env = {};
  const processedContent = await preprocessObsidianContent(content, filePath, imageIndex);
  const tokens = md.parse(processedContent, env);
  applyCalloutTokens(tokens);

  const toc = [];
  const headingCounts = new Map();
  tokens.forEach((token, idx) => {
    if (token.type !== 'heading_open') {
      return;
    }
    const level = Number(token.tag.replace('h', ''));
    if (!Number.isFinite(level) || level < 1 || level > 4) {
      return;
    }
    const inline = tokens[idx + 1];
    if (!inline || inline.type !== 'inline') {
      return;
    }
    const rawText = (inline.children || [])
      .map((child) => (child.type === 'text' || child.type === 'code_inline' ? child.content : ''))
      .join('')
      .trim();
    const text = rawText.replace(/%+/g, '').trim();
    if (!text) {
      return;
    }
    const baseId = slugifyHeading(text) || `section-${toc.length + 1}`;
    const nextCount = (headingCounts.get(baseId) || 0) + 1;
    headingCounts.set(baseId, nextCount);
    const id = nextCount === 1 ? baseId : `${baseId}-${nextCount}`;
    token.attrSet('id', id);
    toc.push({ level, id, text });
  });

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
                  ...(await processImageSource(src, { ...imageOptions, relativePath })),
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
        resolveLocalAsset(normalizedSrc, filePath) ||
        resolveImageFromIndex(path.basename(normalizedSrc), filePath, imageIndex);
      if (!resolved) {
        throw new Error(`${filePath}: image must live under vault (${src})`);
      }
      const ext = path.extname(resolved).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) {
        throw new Error(`${filePath}: unsupported image format ${ext} in ${src}`);
      }
      const cacheKey = `${resolved}:${relativePath}`;
      if (!imageCache.has(cacheKey)) {
        imageCache.set(cacheKey, processImage(resolved, { ...imageOptions, relativePath }));
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

const copyFuseAssets = async (targetDir) => {
  const fusePath = path.resolve('node_modules/fuse.js/dist/fuse.mjs');
  if (await pathExists(fusePath)) {
    await fs.copyFile(fusePath, path.join(targetDir, 'fuse.mjs'));
  }
};

const copyKatexAssets = async (targetDir) => {
  const katexDir = path.resolve('node_modules/katex/dist');
  if (!(await pathExists(katexDir))) {
    return;
  }
  const targetKatexDir = path.join(targetDir, 'katex');
  const targetFontsDir = path.join(targetKatexDir, 'fonts');
  await ensureDir(targetFontsDir);
  await fs.copyFile(
    path.join(katexDir, 'katex.min.css'),
    path.join(targetKatexDir, 'katex.min.css')
  );

  const entries = await fs.readdir(path.join(katexDir, 'fonts'), { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) =>
        fs.copyFile(path.join(katexDir, 'fonts', entry.name), path.join(targetFontsDir, entry.name))
      )
  );
};

const copyThemeAssets = async (targetDir, fontText, themeAssets) => {
  await fs.copyFile(path.join(themeDir, 'styles.css'), path.join(targetDir, 'styles.css'));
  await fs.copyFile(path.join(themeDir, 'app.js'), path.join(targetDir, 'app.js'));

  if (themeAssets && themeAssets.fontsCssPath) {
    await fs.copyFile(
      themeAssets.fontsCssPath,
      path.join(targetDir, THEME_CONSTANTS.assets.fontsCss)
    );
  }

  if (themeAssets && themeAssets.fontsDir) {
    try {
      const targetFontsDir = path.join(targetDir, THEME_CONSTANTS.assets.fontsDir);
      if (fontText) {
        await subsetThemeFonts({
          sourceDir: themeAssets.fontsDir,
          targetDir: targetFontsDir,
          text: fontText,
        });
      } else {
        const entries = await fs.readdir(themeAssets.fontsDir, { withFileTypes: true });
        await ensureDir(targetFontsDir);
        await Promise.all(
          entries
            .filter((entry) => entry.isFile())
            .map((entry) =>
              fs.copyFile(
                path.join(themeAssets.fontsDir, entry.name),
                path.join(targetFontsDir, entry.name)
              )
            )
        );
      }
    } catch (error) {
      if (error && error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  if (themeAssets && themeAssets.icons.length > 0) {
    await Promise.all(
      themeAssets.icons.map((icon) =>
        fs.copyFile(icon.sourcePath, path.join(targetDir, path.basename(icon.sourcePath)))
      )
    );
  }

  await copyKatexAssets(targetDir);
  await copyFuseAssets(targetDir);
};

const writePage = async (targetDir, html) => {
  await ensureDir(targetDir);
  await writeFile(path.join(targetDir, 'index.html'), html);
};

const run = async () => {
  if (outputDir === inputDir) {
    throw new Error('Output directory must be different from input directory.');
  }

  const configDir = await resolveConfigDir(inputDir);
  const defaultConfigDir = path.join(inputDir, '.blog');
  const siteConfig = await readSiteConfig(configDir);
  const siteUrl = getArgValue('--site-url', siteConfig.siteUrl || null);
  const siteTitle = siteConfig.siteTitle || 'Gen Blog';
  const themeAssets = await resolveThemeAssets(defaultConfigDir);
  const fontLinks = buildFontLinks(siteConfig.fontCssUrls);
  const themeLinks = themeAssets.fontsCssPath
    ? `<link rel="stylesheet" href="/${THEME_CONSTANTS.assets.fontsCss}" />`
    : '';
  const iconLinks = themeAssets.icons.length > 0 ? buildIconLinks(themeAssets.icons) : '';
  const labels = THEME_CONSTANTS.labels;
  const allowRemoteImages = siteConfig.allowRemoteImages;
  const preserveOutput = await shouldPreserveOutput(outputDir);
  const buildDir = preserveOutput
    ? await fs.mkdtemp(path.join(os.tmpdir(), 'gen-blog-'))
    : outputDir;

  if (!preserveOutput) {
    await fs.rm(outputDir, { recursive: true, force: true });
  }
  await ensureDir(buildDir);
  await ensureDir(path.join(buildDir, 'posts'));
  await ensureDir(path.join(buildDir, 'assets'));

  const [listTemplate, postTemplate] = await Promise.all([
    readTemplate('index.html'),
    readTemplate('post.html'),
  ]);
  const posts = await loadPosts();
  const groups = buildPostGroups(posts);
  const aboutGroup = groups.find((group) => group.translationKey === 'about') || null;

  const nonAboutPosts = posts.filter((post) => post.translationKey !== 'about');
  const languages = Array.from(new Set(nonAboutPosts.map((post) => post.lang).filter(Boolean)));
  const defaultLang = languages.includes('en') ? 'en' : languages[0] || 'en';

  const fontText = collectFontText(posts, siteTitle);
  await copyThemeAssets(buildDir, fontText, themeAssets);

  const imageCache = new Map();
  const imageIndex = await buildImageIndex(inputDir);
  const imageOptions = {
    outputBase: path.join(buildDir, 'assets'),
    sourceBase: inputDir,
    publicBase: '/assets',
    maxWidth: 680,
    minWidth: 240,
    maxBytes: 600 * 1024,
    jpegQuality: 70,
    webpQuality: 70,
  };

  const processedPosts = await Promise.all(
    posts.map(async (post) => {
      let coverPicture = null;
      if (post.coverImage) {
        const coverRelativePath = buildPostCoverPath(post);
        if (isExternalAsset(post.coverImage)) {
          if (isRemoteAsset(post.coverImage) && !allowRemoteImages) {
            throw new Error(
              `${post.sourcePath}: remote cover images are disabled (${post.coverImage})`
            );
          }
          const cacheKey = `external:${coverRelativePath}:${post.coverImage}`;
          if (!imageCache.has(cacheKey)) {
            imageCache.set(
              cacheKey,
              processImageSource(post.coverImage, {
                ...imageOptions,
                relativePath: coverRelativePath,
              })
            );
          }
          const processed = await imageCache.get(cacheKey);
          coverPicture = processed.picture;
        } else {
          const resolved = resolveLocalAsset(post.coverImage, post.sourcePath);
          if (!resolved) {
            throw new Error(`${post.sourcePath}: cover image must live under vault`);
          }
          const ext = path.extname(resolved).toLowerCase();
          if (!IMAGE_EXTS.has(ext)) {
            throw new Error(`${post.sourcePath}: unsupported cover image format ${ext}`);
          }
          const cacheKey = `${resolved}:${coverRelativePath}`;
          if (!imageCache.has(cacheKey)) {
            imageCache.set(
              cacheKey,
              processImage(resolved, { ...imageOptions, relativePath: coverRelativePath })
            );
          }
          const processed = await imageCache.get(cacheKey);
          coverPicture = processed.picture;
        }
      }

      const { html: contentHtml, toc } = await renderMarkdownWithImages({
        content: post.content,
        filePath: post.sourcePath,
        imageCache,
        imageOptions,
        imageIndex,
        buildImagePath: (index) => buildPostImagePath(post, index),
        allowRemoteImages,
      });
      const tocHtml = buildTocHtml(toc, post.lang);
      const tocLayoutClass = tocHtml ? 'has-toc' : 'no-toc';

      return {
        ...post,
        coverPicture,
        contentHtml,
        tocHtml,
        tocLayoutClass,
      };
    })
  );

  const groupMap = new Map(groups.map((group) => [group.translationKey, group]));
  const postPages = processedPosts.map((post) => {
    const group = groupMap.get(post.translationKey);
    const isAbout = post.translationKey === 'about';
    const resolvePostUrl = (lang) =>
      isAbout
        ? buildHomeUrl(lang, group.defaultLang)
        : buildPostUrl(post.translationKey, lang, group.defaultLang);
    const pageUrl = resolvePostUrl(post.lang);
    const langSwitchUrl = group.languages
      .filter((lang) => lang !== post.lang)
      .map((lang) => resolvePostUrl(lang))[0];

    return {
      ...post,
      url: pageUrl,
      langSwitchUrl,
      defaultLang: group.defaultLang,
      languages: group.languages,
    };
  });

  const listDataByLang = languages.map((lang) => {
    const items = postPages
      .filter((post) => post.lang === lang && post.translationKey !== 'about')
      .sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) {
          return dateDiff;
        }
        return a.translationKey.localeCompare(b.translationKey);
      });
    return { lang, items };
  });

  const rssFeeds = siteUrl
    ? listDataByLang.map((group) => {
        const feedPath = `/rss-${group.lang}.xml`;
        const feedUrl = buildUrl(siteUrl, feedPath);
        return {
          lang: group.lang,
          path: feedPath,
          xml: buildRssFeed({
            siteTitle,
            siteUrl,
            lang: group.lang,
            defaultLang,
            items: group.items,
            feedUrl,
          }),
        };
      })
    : [];
  const defaultRss = rssFeeds.find((feed) => feed.lang === defaultLang) || null;
  const rssOutputs = defaultRss
    ? [...rssFeeds, { lang: defaultLang, path: '/rss.xml', xml: defaultRss.xml }]
    : rssFeeds;
  const rssEnabled = siteUrl && rssOutputs.length > 0;

  const filterIndex = listDataByLang.flatMap((group) =>
    group.items.map((post) => ({
      translationKey: post.translationKey,
      lang: post.lang,
      title: post.title,
      date: post.date,
      categories: post.categories,
      excerpt: post.excerpt,
      coverImage: post.coverPicture
        ? {
            webp: post.coverPicture.sources[0].src,
            fallback: post.coverPicture.img.src,
          }
        : null,
      url: post.url,
    }))
  );

  await writeJson(path.join(buildDir, 'posts', 'filter-index.json'), filterIndex);

  const aboutHtmlByLang = new Map();

  await Promise.all(
    postPages.map(async (post) => {
      const canonicalUrl = buildUrl(siteUrl, post.url);
      const isAbout = post.translationKey === 'about';
      const hreflangLinks = buildHreflangLinks(
        post.languages.reduce((acc, lang) => {
          const url = isAbout
            ? buildHomeUrl(lang, post.defaultLang)
            : buildPostUrl(post.translationKey, lang, post.defaultLang);
          acc[lang] = buildUrl(siteUrl, url);
          return acc;
        }, {})
      );

      const metaTags = buildMetaForPost(post, siteTitle, canonicalUrl, hreflangLinks, siteUrl);
      const rssLinks = rssEnabled ? buildRssLinks(post.lang, defaultLang, siteUrl) : '';
      const articleHtml = buildArticleHtml(post);
      const pageData = {
        pageType: post.translationKey === 'about' ? 'about' : 'post',
        lang: post.lang,
        langSwitchUrl: post.langSwitchUrl || null,
        langSwitcherMode: post.langSwitchUrl ? 'toggle' : 'hidden',
        labels: {
          navAbout: labels.navAbout,
          navBlog: labels.navBlog,
          filterAll: labels.filterAll,
        },
      };

      const html = renderTemplate(postTemplate, {
        PAGE_TITLE: isAbout ? siteTitle : `${post.title} | ${siteTitle}`,
        META_TAGS: metaTags,
        RSS_LINKS: rssLinks,
        ICON_LINKS: iconLinks,
        FONT_LINKS: fontLinks,
        THEME_LINKS: themeLinks,
        LANG: post.lang,
        HOME_URL: buildHomeUrl(post.lang, defaultLang),
        ABOUT_URL: buildAboutUrl(post.lang, defaultLang, aboutGroup),
        BLOG_URL: buildListUrl(post.lang, defaultLang),
        NAV_ABOUT_LABEL: labels.navAbout,
        NAV_BLOG_LABEL: labels.navBlog,
        SITE_TITLE: siteTitle,
        ARTICLE_CONTENT: articleHtml,
        TOC: post.tocHtml,
        TOC_LAYOUT_CLASS: post.tocLayoutClass,
        LANG_SWITCH_MODE: post.langSwitchUrl ? 'toggle' : 'hidden',
        PAGE_DATA: JSON.stringify(pageData, null, 2),
      });

      const targetDir = path.join(buildDir, stripLeadingSlash(post.url));
      await writePage(targetDir, html);
      if (isAbout) {
        aboutHtmlByLang.set(post.lang, html);
      }
    })
  );

  if (aboutHtmlByLang.size > 0) {
    await Promise.all(
      Array.from(aboutHtmlByLang.entries()).map(async ([lang, html]) => {
        const aliasUrl = buildAboutUrl(lang, defaultLang, aboutGroup);
        const targetDir = path.join(buildDir, stripLeadingSlash(aliasUrl));
        await writePage(targetDir, html);
      })
    );
  }

  if (rssOutputs.length > 0) {
    await Promise.all(
      rssOutputs.map((feed) =>
        writeFile(path.join(buildDir, stripLeadingSlash(feed.path)), feed.xml)
      )
    );
  }

  await Promise.all(
    listDataByLang.map(async (group) => {
      const pageUrl = buildListUrl(group.lang, defaultLang);
      const categorySet = new Set();
      group.items.forEach((item) => {
        (item.categories || []).forEach((cat) => categorySet.add(cat));
      });
      const sortedCategoryNames = Array.from(categorySet).sort((a, b) => a.localeCompare(b));
      const listHtml = buildListSectionsHtml(group.items, sortedCategoryNames);
      const canonicalUrl = buildUrl(siteUrl, pageUrl);
      const otherLang = languages.find((lang) => lang !== group.lang) || null;
      const hreflangLinks = buildHreflangLinks(
        languages.reduce((acc, lang) => {
          acc[lang] = buildUrl(siteUrl, buildListUrl(lang, defaultLang));
          return acc;
        }, {})
      );
      const metaTags = buildMetaForList(
        siteTitle,
        'Latest posts and essays.',
        canonicalUrl,
        null,
        null,
        hreflangLinks
      );
      const rssLinks = rssEnabled ? buildRssLinks(group.lang, defaultLang, siteUrl) : '';

      const pageData = {
        pageType: 'list',
        lang: group.lang,
        langSwitchUrl: otherLang ? buildListUrl(otherLang, defaultLang) : null,
        langSwitcherMode: otherLang ? 'toggle' : 'hidden',
        filterIndexUrl: '/posts/filter-index.json',
        labels: {
          navAbout: labels.navAbout,
          navBlog: labels.navBlog,
          filterAll: labels.filterAll,
        },
        posts: group.items.map((item) => ({
          translationKey: item.translationKey,
          title: item.title,
          date: item.date,
          categories: item.categories,
          excerpt: item.excerpt,
          coverImage: item.coverPicture
            ? {
                webp: item.coverPicture.sources[0].src,
                fallback: item.coverPicture.img.src,
              }
            : null,
          url: item.url,
        })),
      };

      const html = renderTemplate(listTemplate, {
        PAGE_TITLE: `${siteTitle}`,
        META_TAGS: metaTags,
        RSS_LINKS: rssLinks,
        ICON_LINKS: iconLinks,
        FONT_LINKS: fontLinks,
        THEME_LINKS: themeLinks,
        LANG: group.lang,
        HOME_URL: buildHomeUrl(group.lang, defaultLang),
        ABOUT_URL: buildAboutUrl(group.lang, defaultLang, aboutGroup),
        BLOG_URL: buildListUrl(group.lang, defaultLang),
        NAV_ABOUT_LABEL: labels.navAbout,
        NAV_BLOG_LABEL: labels.navBlog,
        SITE_TITLE: siteTitle,
        LIST_CONTENT: listHtml,
        LANG_SWITCH_MODE: otherLang ? 'toggle' : 'hidden',
        SEARCH_PLACEHOLDER: labels.searchPlaceholder,
        PAGE_DATA: JSON.stringify(pageData, null, 2),
      });

      const targetDir = path.join(buildDir, stripLeadingSlash(pageUrl));
      await writePage(targetDir, html);
    })
  );

  if (siteUrl) {
    const urls = [
      ...postPages.map((post) => buildUrl(siteUrl, post.url)),
      ...listDataByLang.map((group) => buildUrl(siteUrl, buildListUrl(group.lang, defaultLang))),
    ];
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((url) => `  <url><loc>${url}</loc></url>`)
      .join('\n')}\n</urlset>\n`;
    await writeFile(path.join(buildDir, 'sitemap.xml'), sitemap);
    await writeFile(
      path.join(buildDir, 'robots.txt'),
      `User-agent: *\nAllow: /\nSitemap: ${buildUrl(siteUrl, '/sitemap.xml')}\n`
    );
  }

  if (preserveOutput) {
    await ensureDir(outputDir);
    await syncDirectory(buildDir, outputDir, new Set(['.git', 'CNAME', '.nojekyll']));
    await fs.rm(buildDir, { recursive: true, force: true });
  }

  console.log(`Generated ${postPages.length} posts in ${outputDir}`);
};

run().catch((error) => {
  console.error('Generation failed:', error);
  process.exit(1);
});
