import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { processImage, processImageSource } from './images.js';
import { buildRssFeed } from './content/rss.js';
import { copyThemeAssets } from './media/assets.js';
import { buildPostGroups, loadPosts } from './content/content.js';
import { buildImageIndex, resolveImageFromIndex } from './media/image-index.js';
import { isExternalAsset, isRemoteAsset, resolveLocalAsset } from './media/asset-resolver.js';
import { renderMarkdownWithImages } from './content/markdown-renderer.js';
import { preprocessObsidianContent } from './obsidian.js';
import {
  ensureDir,
  pathExists,
  shouldPreserveOutput,
  writeFile,
  writeJson,
} from './shared/fs-utils.js';
import { buildFontLinks, buildIconLinks, readTemplate } from './shared/templates.js';
import { buildPostSummary, decorateListItems } from './shared/list-presenter.js';
import { buildTocHtml } from './content/pages.js';
import {
  buildHomeUrl,
  buildListUrl,
  buildPostCoverPath,
  buildPostImagePath,
  buildPostMarkdownPath,
  buildPostUrl,
  stripLeadingSlash,
  buildUrl,
} from './shared/paths.js';
import { THEME_CONSTANTS } from '../theme.constants.js';
import { writeAboutAliases, writePostPages, writeRssFiles } from './generator/generate-output.js';
import { writeAskAiPage } from './generator/generate-ask-ai-output.js';
import {
  finalizeOutputDirectory,
  writeListPages,
  writeSitemapAndRobots,
} from './generator/generate-list-output.js';

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
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png']);
const IMAGE_CONCURRENCY = Math.max(2, Math.min(os.cpus().length, 6));

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

const AUTHOR_SOCIAL_TYPES = new Set(['email', 'x', 'github', 'xiaohongshu', 'rss']);

const ensureObject = (value, errorMessage) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorMessage);
  }
  return value;
};

const readTrimmedString = ({ value, fallback = '', allowNull = false }) => {
  if (value === undefined) {
    return allowNull ? null : fallback;
  }
  const trimmed = String(value || '').trim();
  if (!trimmed && !allowNull) {
    return fallback;
  }
  return trimmed || null;
};

const normalizeAuthorSocialEntry = (entry, index) => {
  ensureObject(entry, `author.config.json: social[${index}] must be an object`);
  if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') {
    throw new Error(`author.config.json: social[${index}].enabled must be a boolean`);
  }
  if (entry.enabled === false) {
    return null;
  }
  const rawType = readTrimmedString({
    value: entry.type,
    fallback: '',
  })
    .toLowerCase()
    .trim();
  if (!rawType) {
    throw new Error(`author.config.json: social[${index}].type must be a non-empty string`);
  }
  if (!AUTHOR_SOCIAL_TYPES.has(rawType)) {
    throw new Error(`author.config.json: social[${index}].type "${rawType}" is not supported`);
  }
  const rawValue = readTrimmedString({
    value: entry.value,
    fallback: '',
  });
  if (!rawValue) {
    throw new Error(`author.config.json: social[${index}].value must be a non-empty string`);
  }
  const rawLabel = readTrimmedString({
    value: entry.label,
    allowNull: true,
  });
  if (entry.label !== undefined && !rawLabel) {
    throw new Error(`author.config.json: social[${index}].label must be a non-empty string`);
  }
  return {
    type: rawType,
    value: rawValue,
    label: rawLabel || null,
  };
};

const normalizeAuthorSocial = (value) => {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error('author.config.json: social must be an array');
  }
  return value.map(normalizeAuthorSocialEntry).filter(Boolean);
};

const parseAuthorConfig = (parsed) => {
  ensureObject(parsed, 'author.config.json must be a JSON object');
  const avatar = readTrimmedString({
    value: parsed.avatar,
    allowNull: true,
  });
  if (parsed.avatar !== undefined && !avatar) {
    throw new Error('author.config.json: avatar must be a non-empty string');
  }
  const social = normalizeAuthorSocial(parsed.social);
  if (!avatar && social.length === 0) {
    return null;
  }
  return { avatar, social };
};

const readAuthorConfig = async (configDir) => {
  const configPath = path.join(configDir, 'author.config.json');
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return parseAuthorConfig(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

const resolveConfigPath = (configDir, value) =>
  path.isAbsolute(value) ? value : path.join(configDir, value);

const processAvatarImage = async ({ avatarPath, buildDir }) => {
  const exists = await pathExists(avatarPath);
  if (!exists) {
    return null;
  }
  const ext = path.extname(avatarPath).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) {
    throw new Error(`author.config.json: avatar must be .jpg, .jpeg, or .png (got ${ext})`);
  }
  const fileName = `author-avatar${ext}`;
  const targetPath = path.join(buildDir, 'assets', fileName);
  await fs.copyFile(avatarPath, targetPath);
  return `/assets/${fileName}`;
};

const resolveAuthorData = async ({ authorConfig, configDir, buildDir }) => {
  if (!authorConfig) {
    return null;
  }
  const avatarUrl = authorConfig.avatar
    ? await processAvatarImage({
        avatarPath: resolveConfigPath(configDir, authorConfig.avatar),
        buildDir,
      })
    : null;
  const social = authorConfig.social || [];
  if (!avatarUrl && social.length === 0) {
    return null;
  }
  return { avatarUrl, social };
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

const parseCommentsConfig = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  ensureObject(value, 'blog.config.json: comments must be an object');
  const appId = value.appId === undefined ? '' : String(value.appId || '').trim();
  if (!appId) {
    throw new Error('blog.config.json: comments.appId must be a non-empty string');
  }
  return { appId };
};

const parseOptionalConfigString = (parsed, key) => {
  if (parsed[key] === undefined) {
    return null;
  }
  const value = String(parsed[key] || '').trim();
  if (!value) {
    throw new Error(`blog.config.json: ${key} must be a non-empty string`);
  }
  return value;
};

const parseAllowRemoteImages = (parsed) => {
  if (parsed.allowRemoteImages === undefined) {
    return false;
  }
  if (typeof parsed.allowRemoteImages !== 'boolean') {
    throw new Error('blog.config.json: allowRemoteImages must be a boolean');
  }
  return parsed.allowRemoteImages;
};

const parseSiteConfig = (parsed) => {
  ensureObject(parsed, 'blog.config.json must be a JSON object');
  return {
    siteTitle: parseOptionalConfigString(parsed, 'siteTitle'),
    siteUrl: parseOptionalConfigString(parsed, 'siteUrl'),
    allowRemoteImages: parseAllowRemoteImages(parsed),
    fontCssUrls:
      parsed.fontCssUrls === undefined
        ? null
        : normalizeStringList(parsed.fontCssUrls, 'blog.config.json: fontCssUrls'),
    comments: parseCommentsConfig(parsed.comments),
  };
};

const readSiteConfig = async (configDir) => {
  const configPath = path.join(configDir, 'blog.config.json');
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return parseSiteConfig(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        siteTitle: null,
        siteUrl: null,
        allowRemoteImages: false,
        fontCssUrls: null,
        comments: null,
      };
    }
    throw error;
  }
};

const createConcurrencyLimiter = (maxConcurrent) => {
  let activeCount = 0;
  const queue = [];

  const runNext = () => {
    if (activeCount >= maxConcurrent || queue.length === 0) {
      return;
    }
    const entry = queue.shift();
    if (!entry) {
      return;
    }
    activeCount += 1;
    Promise.resolve()
      .then(entry.task)
      .then(entry.resolve, entry.reject)
      .finally(() => {
        activeCount -= 1;
        runNext();
      });
  };

  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      runNext();
    });
};

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

const createBuildDirectory = async () => {
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
  return { preserveOutput, buildDir };
};

const resolveGenerationConfig = async () => {
  const configDir = await resolveConfigDir(inputDir);
  const defaultConfigDir = path.join(inputDir, '.blog');
  const siteConfig = await readSiteConfig(configDir);
  const authorConfig = await readAuthorConfig(defaultConfigDir);
  const siteUrl = getArgValue('--site-url', siteConfig.siteUrl || null);
  const siteTitle = siteConfig.siteTitle || 'Gen Blog';
  const themeAssets = await resolveThemeAssets(defaultConfigDir);
  return {
    configDir,
    defaultConfigDir,
    siteConfig,
    authorConfig,
    siteUrl,
    siteTitle,
    themeAssets,
    fontLinks: buildFontLinks(siteConfig.fontCssUrls),
    themeLinks: themeAssets.fontsCssPath
      ? `<link rel="stylesheet" href="/${THEME_CONSTANTS.assets.fontsCss}" />`
      : '',
    iconLinks: themeAssets.icons.length > 0 ? buildIconLinks(themeAssets.icons) : '',
    labels: THEME_CONSTANTS.labels,
    allowRemoteImages: siteConfig.allowRemoteImages,
  };
};

const resolveLanguageContext = (posts) => {
  const groups = buildPostGroups(posts);
  const aboutGroup = groups.find((group) => group.translationKey === 'about') || null;
  const nonAboutPosts = posts.filter((post) => post.translationKey !== 'about');
  const languages = Array.from(
    new Set(nonAboutPosts.map((post) => post.lang).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const defaultLang = languages.includes('en') ? 'en' : languages[0] || 'en';
  return { groups, aboutGroup, languages, defaultLang };
};

const createImagePipeline = async (buildDir) => {
  const imageCache = new Map();
  const imageIndex = await buildImageIndex(inputDir, IMAGE_EXTS);
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
  const imageLimiter = createConcurrencyLimiter(IMAGE_CONCURRENCY);
  const processImageTask = (input, options) => imageLimiter(() => processImage(input, options));
  const processImageSourceTask = (src, options) =>
    imageLimiter(() => processImageSource(src, options));
  return {
    imageCache,
    imageIndex,
    imageOptions,
    processImageTask,
    processImageSourceTask,
  };
};

const getCachedResult = async (cache, key, factory) => {
  if (!cache.has(key)) {
    cache.set(key, factory());
  }
  return cache.get(key);
};

const processExternalCoverPicture = async ({
  post,
  coverRelativePath,
  allowRemoteImages,
  imageCache,
  imageOptions,
  processImageSourceTask,
}) => {
  if (isRemoteAsset(post.coverImage) && !allowRemoteImages) {
    throw new Error(`${post.sourcePath}: remote cover images are disabled (${post.coverImage})`);
  }
  const cacheKey = `external:${coverRelativePath}:${post.coverImage}`;
  const processed = await getCachedResult(imageCache, cacheKey, () =>
    processImageSourceTask(post.coverImage, {
      ...imageOptions,
      relativePath: coverRelativePath,
    })
  );
  return processed.picture;
};

const processLocalCoverPicture = async ({
  post,
  coverRelativePath,
  imageCache,
  imageOptions,
  processImageTask,
}) => {
  const resolved = resolveLocalAsset({
    src: post.coverImage,
    filePath: post.sourcePath,
    inputDir,
  });
  if (!resolved) {
    throw new Error(`${post.sourcePath}: cover image must live under vault`);
  }
  const ext = path.extname(resolved).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) {
    throw new Error(`${post.sourcePath}: unsupported cover image format ${ext}`);
  }
  const cacheKey = `${resolved}:${coverRelativePath}`;
  const processed = await getCachedResult(imageCache, cacheKey, () =>
    processImageTask(resolved, { ...imageOptions, relativePath: coverRelativePath })
  );
  return processed.picture;
};

const processCoverPicture = async ({ post, allowRemoteImages, imagePipeline }) => {
  if (!post.coverImage) {
    return null;
  }
  const coverRelativePath = buildPostCoverPath(post);
  if (isExternalAsset(post.coverImage)) {
    return processExternalCoverPicture({
      post,
      coverRelativePath,
      allowRemoteImages,
      imageCache: imagePipeline.imageCache,
      imageOptions: imagePipeline.imageOptions,
      processImageSourceTask: imagePipeline.processImageSourceTask,
    });
  }
  return processLocalCoverPicture({
    post,
    coverRelativePath,
    imageCache: imagePipeline.imageCache,
    imageOptions: imagePipeline.imageOptions,
    processImageTask: imagePipeline.processImageTask,
  });
};

const processSinglePost = async ({ post, allowRemoteImages, imagePipeline }) => {
  const coverPicture = await processCoverPicture({
    post,
    allowRemoteImages,
    imagePipeline,
  });
  const { html: contentHtml, toc } = await renderMarkdownWithImages({
    content: post.content,
    filePath: post.sourcePath,
    imageCache: imagePipeline.imageCache,
    imageOptions: imagePipeline.imageOptions,
    imageIndex: imagePipeline.imageIndex,
    buildImagePath: (index) => buildPostImagePath(post, index),
    allowRemoteImages,
    processImageTask: imagePipeline.processImageTask,
    processImageSourceTask: imagePipeline.processImageSourceTask,
    inputDir,
    imageExts: IMAGE_EXTS,
    pathExists,
  });
  const isAbout = post.translationKey === 'about';
  const tocHtml = isAbout ? '' : buildTocHtml(toc, post.lang);
  return {
    ...post,
    coverPicture,
    contentHtml,
    tocHtml,
    tocLayoutClass: isAbout ? 'no-toc' : tocHtml ? 'has-toc' : 'no-toc',
  };
};

const processPostsWithAssets = ({ posts, allowRemoteImages, imagePipeline }) =>
  Promise.all(posts.map((post) => processSinglePost({ post, allowRemoteImages, imagePipeline })));

const buildPostPages = ({ processedPosts, groups }) => {
  const groupMap = new Map(groups.map((group) => [group.translationKey, group]));
  return processedPosts.map((post) => {
    const group = groupMap.get(post.translationKey);
    const isAbout = post.translationKey === 'about';
    const resolvePostUrl = (lang) =>
      isAbout
        ? buildHomeUrl(lang, group.defaultLang)
        : buildPostUrl(post.translationKey, lang, group.defaultLang);
    const pageUrl = resolvePostUrl(post.lang);
    const langSwitchUrl = group.languages.find((lang) => lang !== post.lang)
      ? resolvePostUrl(group.languages.find((lang) => lang !== post.lang))
      : null;
    return {
      ...post,
      url: pageUrl,
      langSwitchUrl,
      defaultLang: group.defaultLang,
      languages: group.languages,
      originLang: group.originLang,
      markdownUrl: buildPostMarkdownPath(post.translationKey),
    };
  });
};

const sortPostsByDate = (a, b) => {
  const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
  if (dateDiff !== 0) {
    return dateDiff;
  }
  return a.translationKey.localeCompare(b.translationKey);
};

const buildListDataByLang = ({ languages, postPages }) =>
  languages.map((lang) => ({
    lang,
    items: decorateListItems(
      postPages
        .filter((post) => post.lang === lang && post.translationKey !== 'about')
        .sort(sortPostsByDate)
    ),
  }));

const buildRssOutputs = ({ siteUrl, listDataByLang, siteTitle, defaultLang }) => {
  if (!siteUrl) {
    return { rssOutputs: [], rssEnabled: false };
  }
  const rssFeeds = listDataByLang.map((group) => {
    const feedPath = `/rss-${group.lang}.xml`;
    return {
      lang: group.lang,
      path: feedPath,
      xml: buildRssFeed({
        siteTitle,
        siteUrl,
        lang: group.lang,
        defaultLang,
        items: group.items,
        feedUrl: buildUrl(siteUrl, feedPath),
        buildUrl,
        buildListUrl,
        absolutizeHtml,
      }),
    };
  });
  const defaultRss = rssFeeds.find((feed) => feed.lang === defaultLang) || null;
  const rssOutputs = defaultRss
    ? [...rssFeeds, { lang: defaultLang, path: '/rss.xml', xml: defaultRss.xml }]
    : rssFeeds;
  return { rssOutputs, rssEnabled: rssOutputs.length > 0 };
};

const buildFilterIndex = (listDataByLang) =>
  listDataByLang.flatMap((group) => group.items.map(buildPostSummary));

const isOriginPage = (post) => post.markdownUrl && post.lang === post.originLang;

const buildOriginPages = (postPages) => postPages.filter(isOriginPage).sort(sortPostsByDate);

const formatMarkdownContent = (content) => `${String(content || '').replace(/\s+$/, '')}\n`;

const writeOriginMarkdownFiles = async ({ buildDir, originPages, imageIndex }) =>
  Promise.all(
    originPages.map(async (post) => {
      const processedContent = await preprocessObsidianContent({
        source: post.content,
        filePath: post.sourcePath,
        imageIndex,
        inputDir,
        imageExts: IMAGE_EXTS,
        pathExists,
        resolveImageFromIndex,
      });
      const outputPath = path.join(buildDir, stripLeadingSlash(post.markdownUrl));
      await ensureDir(path.dirname(outputPath));
      await writeFile(outputPath, formatMarkdownContent(processedContent));
    })
  );

const toPublicUrl = ({ siteUrl, pathName }) => buildUrl(siteUrl, pathName);

const collectFilterTabs = (items) => {
  const categorySet = new Set();
  items.forEach((item) => {
    (item.categories || []).forEach((category) => categorySet.add(category));
  });
  return ['All', ...Array.from(categorySet).sort((a, b) => a.localeCompare(b))];
};

const buildFilterLines = ({ listDataByLang, defaultLang, siteUrl }) =>
  listDataByLang.map((group) => {
    const tabs = collectFilterTabs(group.items).join(', ');
    const listUrl = toPublicUrl({
      siteUrl,
      pathName: buildListUrl(group.lang, defaultLang),
    });
    return `- ${group.lang}: ${tabs} (page: ${listUrl})`;
  });

const buildLlmsTxt = ({ siteTitle, siteUrl, defaultLang, originPages, listDataByLang }) => {
  const pageLines = originPages.map(
    (post) =>
      `- ${post.title} [${post.lang}] (${post.translationKey}) | html: ${toPublicUrl({
        siteUrl,
        pathName: post.url,
      })} | markdown: ${toPublicUrl({ siteUrl, pathName: post.markdownUrl })}`
  );
  const filterLines = buildFilterLines({ listDataByLang, defaultLang, siteUrl });
  return [
    `# ${siteTitle}`,
    '',
    'This file lists canonical markdown URLs for original-language pages.',
    `Home: ${toPublicUrl({ siteUrl, pathName: buildHomeUrl(defaultLang, defaultLang) })}`,
    `Blog: ${toPublicUrl({ siteUrl, pathName: buildListUrl(defaultLang, defaultLang) })}`,
    `Sitemap: ${toPublicUrl({ siteUrl, pathName: '/sitemap.xml' })}`,
    `RSS: ${toPublicUrl({ siteUrl, pathName: '/rss.xml' })}`,
    `Filter index: ${toPublicUrl({ siteUrl, pathName: '/posts/filter-index.json' })}`,
    '',
    'Filter tabs:',
    ...filterLines,
    '',
    'Pages:',
    ...pageLines,
    '',
  ].join('\n');
};

const run = async () => {
  if (outputDir === inputDir) {
    throw new Error('Output directory must be different from input directory.');
  }
  const config = await resolveGenerationConfig();
  const { preserveOutput, buildDir } = await createBuildDirectory();
  const authorData = await resolveAuthorData({
    authorConfig: config.authorConfig,
    configDir: config.defaultConfigDir,
    buildDir,
  });
  const [listTemplate, postTemplate, askAiTemplate] = await Promise.all([
    readTemplate(themeDir, 'index.html'),
    readTemplate(themeDir, 'post.html'),
    readTemplate(themeDir, 'ask-ai.html'),
  ]);
  const posts = await loadPosts(inputDir);
  const languageContext = resolveLanguageContext(posts);
  const fontText = collectFontText(posts, config.siteTitle);
  await copyThemeAssets({
    targetDir: buildDir,
    themeDir,
    fontText,
    themeAssets: config.themeAssets,
  });
  const imagePipeline = await createImagePipeline(buildDir);
  const processedPosts = await processPostsWithAssets({
    posts,
    allowRemoteImages: config.allowRemoteImages,
    imagePipeline,
  });
  const postPages = buildPostPages({
    processedPosts,
    groups: languageContext.groups,
  });
  const originPages = buildOriginPages(postPages);
  const listDataByLang = buildListDataByLang({
    languages: languageContext.languages,
    postPages,
  });
  const { rssOutputs, rssEnabled } = buildRssOutputs({
    siteUrl: config.siteUrl,
    listDataByLang,
    siteTitle: config.siteTitle,
    defaultLang: languageContext.defaultLang,
  });
  const stringifyPageData = (value) => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');
  await writeJson(
    path.join(buildDir, 'posts', 'filter-index.json'),
    buildFilterIndex(listDataByLang)
  );
  await writeOriginMarkdownFiles({
    buildDir,
    originPages,
    imageIndex: imagePipeline.imageIndex,
  });
  await writeFile(
    path.join(buildDir, 'llms.txt'),
    buildLlmsTxt({
      siteTitle: config.siteTitle,
      siteUrl: config.siteUrl,
      defaultLang: languageContext.defaultLang,
      originPages,
      listDataByLang,
    })
  );
  const aboutHtmlByLang = await writePostPages({
    postPages,
    buildDir,
    postTemplate,
    siteTitle: config.siteTitle,
    siteUrl: config.siteUrl,
    defaultLang: languageContext.defaultLang,
    aboutGroup: languageContext.aboutGroup,
    iconLinks: config.iconLinks,
    fontLinks: config.fontLinks,
    themeLinks: config.themeLinks,
    labels: config.labels,
    rssEnabled,
    authorData,
    commentsConfig: config.siteConfig.comments,
    stringifyPageData,
  });
  await writeAboutAliases({
    aboutHtmlByLang,
    defaultLang: languageContext.defaultLang,
    aboutGroup: languageContext.aboutGroup,
    buildDir,
  });
  await writeRssFiles({ rssOutputs, buildDir });
  await writeListPages({
    listDataByLang,
    languages: languageContext.languages,
    defaultLang: languageContext.defaultLang,
    siteTitle: config.siteTitle,
    siteUrl: config.siteUrl,
    listTemplate,
    buildDir,
    labels: config.labels,
    iconLinks: config.iconLinks,
    fontLinks: config.fontLinks,
    themeLinks: config.themeLinks,
    aboutGroup: languageContext.aboutGroup,
    rssEnabled,
    stringifyPageData,
  });
  await writeAskAiPage({
    askAiTemplate,
    buildDir,
    siteTitle: config.siteTitle,
    siteUrl: config.siteUrl,
    defaultLang: languageContext.defaultLang,
    aboutGroup: languageContext.aboutGroup,
    labels: config.labels,
    iconLinks: config.iconLinks,
    fontLinks: config.fontLinks,
    themeLinks: config.themeLinks,
    stringifyPageData,
  });
  await writeSitemapAndRobots({
    siteUrl: config.siteUrl,
    postPages,
    listDataByLang,
    defaultLang: languageContext.defaultLang,
    extraPaths: ['/ask-ai/'],
    buildDir,
  });
  await finalizeOutputDirectory({ preserveOutput, buildDir, outputDir });
  console.log(`Generated ${postPages.length} posts in ${outputDir}`);
};

run().catch((error) => {
  console.error('Generation failed:', error);
  process.exit(1);
});
