import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { processImage, processImageSource } from './images.js';
import { buildRssFeed, buildRssLinks } from './rss.js';
import { copyThemeAssets } from './assets.js';
import { buildPostGroups, loadPosts } from './content.js';
import { buildImageIndex } from './image-index.js';
import { isExternalAsset, isRemoteAsset, resolveLocalAsset } from './asset-resolver.js';
import { renderMarkdownWithImages } from './markdown-renderer.js';
import {
  ensureDir,
  pathExists,
  shouldPreserveOutput,
  syncDirectory,
  writeFile,
  writeJson,
  writePage,
} from './fs-utils.js';
import { buildFontLinks, buildIconLinks, readTemplate, renderTemplate } from './templates.js';
import {
  buildArticleHtml,
  buildHreflangLinks,
  buildListSectionsHtml,
  buildMetaForList,
  buildMetaForPost,
  buildTocHtml,
} from './pages.js';
import {
  buildAboutUrl,
  buildHomeUrl,
  buildListUrl,
  buildPostCoverPath,
  buildPostImagePath,
  buildPostUrl,
  buildUrl,
  stripLeadingSlash,
} from './paths.js';
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
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('blog.config.json: comments must be an object');
  }
  const appId = value.appId === undefined ? '' : String(value.appId || '').trim();
  if (!appId) {
    throw new Error('blog.config.json: comments.appId must be a non-empty string');
  }
  return { appId };
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
    const comments = parseCommentsConfig(parsed.comments);
    return { siteTitle, siteUrl, allowRemoteImages, fontCssUrls, comments };
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

const stringifyPageData = (value) => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');

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
    readTemplate(themeDir, 'index.html'),
    readTemplate(themeDir, 'post.html'),
  ]);
  const posts = await loadPosts(inputDir);
  const groups = buildPostGroups(posts);
  const aboutGroup = groups.find((group) => group.translationKey === 'about') || null;

  const nonAboutPosts = posts.filter((post) => post.translationKey !== 'about');
  const languages = Array.from(
    new Set(nonAboutPosts.map((post) => post.lang).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const defaultLang = languages.includes('en') ? 'en' : languages[0] || 'en';

  const fontText = collectFontText(posts, siteTitle);
  await copyThemeAssets({
    targetDir: buildDir,
    themeDir,
    fontText,
    themeAssets,
  });

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
              processImageSourceTask(post.coverImage, {
                ...imageOptions,
                relativePath: coverRelativePath,
              })
            );
          }
          const processed = await imageCache.get(cacheKey);
          coverPicture = processed.picture;
        } else {
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
          if (!imageCache.has(cacheKey)) {
            imageCache.set(
              cacheKey,
              processImageTask(resolved, { ...imageOptions, relativePath: coverRelativePath })
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
        processImageTask,
        processImageSourceTask,
        inputDir,
        imageExts: IMAGE_EXTS,
        pathExists,
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
            buildUrl,
            buildListUrl,
            absolutizeHtml,
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

      const metaTags = buildMetaForPost({
        post,
        siteTitle,
        canonicalUrl,
        hreflangLinks,
        baseUrl: siteUrl,
        buildUrl,
      });
      const rssLinks = rssEnabled
        ? buildRssLinks({
            lang: post.lang,
            defaultLang,
            siteUrl,
            buildUrl,
          })
        : '';
      const articleHtml = buildArticleHtml(post);
      const commentsConfig = siteConfig.comments;
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
        comments:
          isAbout || !commentsConfig
            ? null
            : {
                appId: commentsConfig.appId,
                pageId: post.translationKey,
                pageUrl: canonicalUrl || post.url,
                pageTitle: post.title,
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
        PAGE_DATA: stringifyPageData(pageData),
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
      const metaTags = buildMetaForList({
        siteTitle,
        description: 'Latest posts and essays.',
        canonicalUrl,
        prevUrl: null,
        nextUrl: null,
        hreflangLinks,
      });
      const rssLinks = rssEnabled
        ? buildRssLinks({
            lang: group.lang,
            defaultLang,
            siteUrl,
            buildUrl,
          })
        : '';

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
        PAGE_DATA: stringifyPageData(pageData),
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
