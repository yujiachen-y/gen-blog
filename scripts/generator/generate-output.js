import path from 'node:path';
import { buildRssLinks } from '../content/rss.js';
import { writeFile, writePage } from '../shared/fs-utils.js';
import { buildHreflangLinks, buildArticleHtml, buildMetaForPost } from '../content/pages.js';
import {
  buildAboutUrl,
  buildHomeUrl,
  buildListUrl,
  buildPostUrl,
  buildUrl,
  stripLeadingSlash,
} from '../shared/paths.js';
import { renderTemplate } from '../shared/templates.js';

const buildPostHreflangLinks = ({ post, isAbout, siteUrl }) =>
  buildHreflangLinks(
    post.languages.reduce((acc, lang) => {
      const url = isAbout
        ? buildHomeUrl(lang, post.defaultLang)
        : buildPostUrl(post.translationKey, lang, post.defaultLang);
      acc[lang] = buildUrl(siteUrl, url);
      return acc;
    }, {})
  );

const buildPostPageData = ({ post, isAbout, labels, commentsConfig, canonicalUrl }) => ({
  pageType: isAbout ? 'about' : 'post',
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
});

const writeSinglePostPage = async ({
  post,
  buildDir,
  postTemplate,
  siteTitle,
  siteUrl,
  defaultLang,
  aboutGroup,
  iconLinks,
  fontLinks,
  themeLinks,
  labels,
  rssEnabled,
  stringifyPageData,
  profileSidebarHtml,
  commentsConfig,
}) => {
  const canonicalUrl = buildUrl(siteUrl, post.url);
  const isAbout = post.translationKey === 'about';
  const sidebarHtml = isAbout ? profileSidebarHtml || '' : post.tocHtml;
  const layoutClass = isAbout
    ? profileSidebarHtml
      ? 'has-profile'
      : 'no-toc'
    : post.tocLayoutClass;
  const metaTags = buildMetaForPost({
    post,
    siteTitle,
    canonicalUrl,
    hreflangLinks: buildPostHreflangLinks({ post, isAbout, siteUrl }),
    baseUrl: siteUrl,
    buildUrl,
  });
  const html = renderTemplate(postTemplate, {
    PAGE_TITLE: isAbout ? siteTitle : `${post.title} | ${siteTitle}`,
    META_TAGS: metaTags,
    RSS_LINKS: rssEnabled
      ? buildRssLinks({
          lang: post.lang,
          defaultLang,
          siteUrl,
          buildUrl,
        })
      : '',
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
    ARTICLE_CONTENT: buildArticleHtml(post, { isAbout }),
    TOC: sidebarHtml,
    TOC_LAYOUT_CLASS: layoutClass,
    LANG_SWITCH_MODE: post.langSwitchUrl ? 'toggle' : 'hidden',
    PAGE_DATA: stringifyPageData(
      buildPostPageData({
        post,
        isAbout,
        labels,
        commentsConfig,
        canonicalUrl,
      })
    ),
  });
  await writePage(path.join(buildDir, stripLeadingSlash(post.url)), html);
  return { isAbout, lang: post.lang, html };
};

export const writePostPages = async (options) => {
  const renderedPages = await Promise.all(
    options.postPages.map((post) =>
      writeSinglePostPage({
        post,
        ...options,
      })
    )
  );
  return renderedPages
    .filter((item) => item.isAbout)
    .reduce((acc, item) => acc.set(item.lang, item.html), new Map());
};

export const writeAboutAliases = async ({ aboutHtmlByLang, defaultLang, aboutGroup, buildDir }) => {
  if (aboutHtmlByLang.size === 0) return;
  await Promise.all(
    Array.from(aboutHtmlByLang.entries()).map(async ([lang, html]) => {
      const aliasUrl = buildAboutUrl(lang, defaultLang, aboutGroup);
      await writePage(path.join(buildDir, stripLeadingSlash(aliasUrl)), html);
    })
  );
};

export const writeRssFiles = async ({ rssOutputs, buildDir }) => {
  if (rssOutputs.length === 0) return;
  await Promise.all(
    rssOutputs.map((feed) => writeFile(path.join(buildDir, stripLeadingSlash(feed.path)), feed.xml))
  );
};
