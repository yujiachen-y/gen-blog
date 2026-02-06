import fs from 'node:fs/promises';
import path from 'node:path';
import { buildRssLinks } from '../content/rss.js';
import { ensureDir, syncDirectory, writeFile, writePage } from '../shared/fs-utils.js';
import { buildListSectionsHtml, buildMetaForList, buildHreflangLinks } from '../content/pages.js';
import {
  buildAboutUrl,
  buildHomeUrl,
  buildListUrl,
  buildUrl,
  stripLeadingSlash,
} from '../shared/paths.js';
import { renderTemplate } from '../shared/templates.js';

const collectListCategories = (items) => {
  const categorySet = new Set();
  items.forEach((item) => {
    (item.categories || []).forEach((cat) => categorySet.add(cat));
  });
  return Array.from(categorySet).sort((a, b) => a.localeCompare(b));
};

const buildListPageData = ({ group, otherLang, defaultLang, labels }) => ({
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
});

const writeSingleListPage = async ({
  group,
  languages,
  defaultLang,
  siteTitle,
  siteUrl,
  listTemplate,
  buildDir,
  labels,
  iconLinks,
  fontLinks,
  themeLinks,
  aboutGroup,
  rssEnabled,
  stringifyPageData,
}) => {
  const pageUrl = buildListUrl(group.lang, defaultLang);
  const otherLang = languages.find((lang) => lang !== group.lang) || null;
  const hreflangLinks = buildHreflangLinks(
    languages.reduce((acc, lang) => {
      acc[lang] = buildUrl(siteUrl, buildListUrl(lang, defaultLang));
      return acc;
    }, {})
  );
  const rssLinks = rssEnabled
    ? buildRssLinks({
        lang: group.lang,
        defaultLang,
        siteUrl,
        buildUrl,
      })
    : '';
  const html = renderTemplate(listTemplate, {
    PAGE_TITLE: `${siteTitle}`,
    META_TAGS: buildMetaForList({
      siteTitle,
      description: 'Latest posts and essays.',
      canonicalUrl: buildUrl(siteUrl, pageUrl),
      prevUrl: null,
      nextUrl: null,
      hreflangLinks,
    }),
    RSS_LINKS: rssLinks,
    ICON_LINKS: iconLinks,
    FONT_LINKS: fontLinks,
    THEME_LINKS: themeLinks,
    LANG: group.lang,
    HOME_URL: buildHomeUrl(group.lang, defaultLang),
    ABOUT_URL: buildAboutUrl(group.lang, defaultLang, aboutGroup),
    BLOG_URL: pageUrl,
    NAV_ABOUT_LABEL: labels.navAbout,
    NAV_BLOG_LABEL: labels.navBlog,
    SITE_TITLE: siteTitle,
    LIST_CONTENT: buildListSectionsHtml(group.items, collectListCategories(group.items)),
    LANG_SWITCH_MODE: otherLang ? 'toggle' : 'hidden',
    SEARCH_PLACEHOLDER: labels.searchPlaceholder,
    PAGE_DATA: stringifyPageData(buildListPageData({ group, otherLang, defaultLang, labels })),
  });
  await writePage(path.join(buildDir, stripLeadingSlash(pageUrl)), html);
};

export const writeListPages = async (options) =>
  Promise.all(options.listDataByLang.map((group) => writeSingleListPage({ group, ...options })));

export const writeSitemapAndRobots = async ({
  siteUrl,
  postPages,
  listDataByLang,
  defaultLang,
  buildDir,
}) => {
  if (!siteUrl) return;
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
};

export const finalizeOutputDirectory = async ({ preserveOutput, buildDir, outputDir }) => {
  if (!preserveOutput) return;
  await ensureDir(outputDir);
  await syncDirectory(buildDir, outputDir, new Set(['.git', 'CNAME', '.nojekyll']));
  await fs.rm(buildDir, { recursive: true, force: true });
};
