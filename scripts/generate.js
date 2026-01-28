import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { createMarkdownRenderer } from './markdown.js';
import { processImage, processImageSource } from './images.js';

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

const readSiteConfig = async () => {
  const configPath = path.join(inputDir, 'blog.config.json');
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
    return { siteTitle, siteUrl };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { siteTitle: null, siteUrl: null };
    }
    throw error;
  }
};

const renderTemplate = (template, values) =>
  Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value ?? '')),
    template
  );

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

const buildCardHtml = (post) => {
  const categoryLabel = post.categories[0] || 'General';
  const coverHtml = post.coverPicture
    ? buildPictureHtml(post.coverPicture, {
        alt: post.title,
        imgClass: 'card-image',
        loading: 'lazy',
      })
    : '';

  return `\n<a class="card${post.coverPicture ? ' has-image' : ''}" href="${post.url}">\n  <div class="card-content-wrapper">\n    <div class="card-date">${escapeHtml(post.date)} · ${escapeHtml(
    categoryLabel.toUpperCase()
  )}</div>\n    <div class="card-title">${escapeHtml(post.title)}</div>\n    <div class="card-excerpt">${escapeHtml(post.excerpt)}</div>\n  </div>\n  ${coverHtml}\n</a>\n`;
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
    const defaultLang = languages.includes('zh') ? 'zh' : languages[0];
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

const buildPostUrl = (translationKey, lang, defaultLang) => {
  const langSegment = lang === defaultLang ? '' : `/${lang}`;
  return `/${translationKey}${langSegment}/`;
};

const buildListUrl = (lang, defaultLang) => {
  const prefix = lang === defaultLang ? '' : `/${lang}`;
  return `${prefix}/` || '/';
};

const buildListSectionsHtml = (items) => {
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
      const cards = group.items.map((item) => buildCardHtml(item)).join('');
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

  const resolvedImages = await Promise.all(
    imageSources.map(async (src) => {
      if (isExternalAsset(src)) {
        const cacheKey = `external:${src}`;
        if (!imageCache.has(cacheKey)) {
          imageCache.set(
            cacheKey,
            (async () => {
              try {
                return { ...(await processImageSource(src, imageOptions)), external: false };
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
      if (!imageCache.has(resolved)) {
        imageCache.set(resolved, processImage(resolved, imageOptions));
      }
      const processed = await imageCache.get(resolved);
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

const copyThemeAssets = async (targetDir) => {
  await fs.copyFile(path.join(themeDir, 'styles.css'), path.join(targetDir, 'styles.css'));
  await fs.copyFile(path.join(themeDir, 'app.js'), path.join(targetDir, 'app.js'));
  await fs.copyFile(path.join(themeDir, 'favicon.png'), path.join(targetDir, 'favicon.png'));
  await fs.copyFile(path.join(themeDir, 'favicon-32.png'), path.join(targetDir, 'favicon-32.png'));
  await fs.copyFile(
    path.join(themeDir, 'apple-touch-icon.png'),
    path.join(targetDir, 'apple-touch-icon.png')
  );
  const fontsDir = path.join(themeDir, 'fonts');
  try {
    const entries = await fs.readdir(fontsDir, { withFileTypes: true });
    const targetFontsDir = path.join(targetDir, 'fonts');
    await ensureDir(targetFontsDir);
    await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map((entry) =>
          fs.copyFile(path.join(fontsDir, entry.name), path.join(targetFontsDir, entry.name))
        )
    );
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }
  }
  await copyKatexAssets(targetDir);
};

const writePage = async (targetDir, html) => {
  await ensureDir(targetDir);
  await writeFile(path.join(targetDir, 'index.html'), html);
};

const run = async () => {
  if (outputDir === inputDir) {
    throw new Error('Output directory must be different from input directory.');
  }

  const siteConfig = await readSiteConfig();
  const siteUrl = getArgValue('--site-url', siteConfig.siteUrl || null);
  const siteTitle = siteConfig.siteTitle || 'Gen Blog';
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

  await copyThemeAssets(buildDir);

  const posts = await loadPosts();
  const groups = buildPostGroups(posts);
  const aboutGroup = groups.find((group) => group.translationKey === 'about') || null;

  const nonAboutPosts = posts.filter((post) => post.translationKey !== 'about');
  const languages = Array.from(new Set(nonAboutPosts.map((post) => post.lang).filter(Boolean)));
  const defaultLang = languages.includes('zh') ? 'zh' : languages[0] || 'en';

  const imageCache = new Map();
  const imageIndex = await buildImageIndex(inputDir);
  const imageOptions = {
    outputBase: path.join(buildDir, 'assets'),
    sourceBase: inputDir,
    publicBase: '/assets',
    maxWidth: 680,
  };

  const processedPosts = await Promise.all(
    posts.map(async (post) => {
      let coverPicture = null;
      if (post.coverImage) {
        if (isExternalAsset(post.coverImage)) {
          const cacheKey = `external:${post.coverImage}`;
          if (!imageCache.has(cacheKey)) {
            imageCache.set(cacheKey, processImageSource(post.coverImage, imageOptions));
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
          if (!imageCache.has(resolved)) {
            imageCache.set(resolved, processImage(resolved, imageOptions));
          }
          const processed = await imageCache.get(resolved);
          coverPicture = processed.picture;
        }
      }

      const { html: contentHtml, toc } = await renderMarkdownWithImages({
        content: post.content,
        filePath: post.sourcePath,
        imageCache,
        imageOptions,
        imageIndex,
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
    const pageUrl = buildPostUrl(post.translationKey, post.lang, group.defaultLang);
    const langSwitchUrl = group.languages
      .filter((lang) => lang !== post.lang)
      .map((lang) => buildPostUrl(post.translationKey, lang, group.defaultLang))[0];

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

  await Promise.all(
    postPages.map(async (post) => {
      const canonicalUrl = buildUrl(siteUrl, post.url);
      const hreflangLinks = buildHreflangLinks(
        post.languages.reduce((acc, lang) => {
          acc[lang] = buildUrl(siteUrl, buildPostUrl(post.translationKey, lang, post.defaultLang));
          return acc;
        }, {})
      );

      const metaTags = buildMetaForPost(post, siteTitle, canonicalUrl, hreflangLinks, siteUrl);
      const articleHtml = buildArticleHtml(post);
      const pageData = {
        pageType: post.translationKey === 'about' ? 'about' : 'post',
        lang: post.lang,
        langSwitchUrl: post.langSwitchUrl || null,
        langSwitcherMode: post.langSwitchUrl ? 'toggle' : 'hidden',
      };

      const html = renderTemplate(postTemplate, {
        PAGE_TITLE: `${post.title} | ${siteTitle}`,
        META_TAGS: metaTags,
        LANG: post.lang,
        HOME_URL: buildListUrl(post.lang, defaultLang),
        ABOUT_URL: buildAboutUrl(post.lang, defaultLang, aboutGroup),
        SITE_TITLE: siteTitle,
        ARTICLE_CONTENT: articleHtml,
        TOC: post.tocHtml,
        TOC_LAYOUT_CLASS: post.tocLayoutClass,
        LANG_SWITCH_MODE: post.langSwitchUrl ? 'toggle' : 'hidden',
        PAGE_DATA: JSON.stringify(pageData, null, 2),
      });

      const targetDir = path.join(buildDir, stripLeadingSlash(post.url));
      await writePage(targetDir, html);
    })
  );

  await Promise.all(
    listDataByLang.map(async (group) => {
      const pageUrl = buildListUrl(group.lang, defaultLang);
      const listHtml = buildListSectionsHtml(group.items);
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

      const pageData = {
        pageType: 'list',
        lang: group.lang,
        langSwitchUrl: otherLang ? buildListUrl(otherLang, defaultLang) : null,
        langSwitcherMode: otherLang ? 'toggle' : 'hidden',
        filterIndexUrl: '/posts/filter-index.json',
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
        LANG: group.lang,
        HOME_URL: buildListUrl(group.lang, defaultLang),
        ABOUT_URL: buildAboutUrl(group.lang, defaultLang, aboutGroup),
        SITE_TITLE: siteTitle,
        LIST_CONTENT: listHtml,
        LANG_SWITCH_MODE: otherLang ? 'toggle' : 'hidden',
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
