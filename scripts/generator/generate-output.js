import path from 'node:path';
import { buildNavbarHtml } from '../content/layout.js';
import { buildRssLinks } from '../content/rss.js';
import { writeFile, writePage } from '../shared/fs-utils.js';
import {
  buildHreflangLinks,
  buildArticleHtml,
  buildMetaForPost,
  buildProfileSidebarHtml,
} from '../content/pages.js';
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
  markdownUrl: isAbout ? null : post.markdownUrl || null,
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

const resolveSidebarLayout = ({ post, isAbout, authorData }) => {
  if (!isAbout) {
    return {
      sidebarHtml: post.tocHtml,
      layoutClass: post.tocLayoutClass,
    };
  }
  const profileSidebarHtml = buildProfileSidebarHtml(authorData, post.lang);
  return {
    sidebarHtml: profileSidebarHtml,
    layoutClass: profileSidebarHtml ? 'has-profile' : 'no-toc',
  };
};

const buildPostMetaTags = ({ post, siteTitle, canonicalUrl, isAbout, siteUrl }) =>
  buildMetaForPost({
    post,
    siteTitle,
    canonicalUrl,
    hreflangLinks: buildPostHreflangLinks({ post, isAbout, siteUrl }),
    markdownAlternateUrl: post.markdownUrl ? buildUrl(siteUrl, post.markdownUrl) : null,
    baseUrl: siteUrl,
    buildUrl,
  });

const buildPostRenderContext = ({ post, defaultLang, aboutGroup, labels, siteTitle }) => {
  const homeUrl = buildHomeUrl(post.lang, defaultLang);
  const aboutUrl = buildAboutUrl(post.lang, defaultLang, aboutGroup);
  const blogUrl = buildListUrl(post.lang, defaultLang);
  const langSwitchMode = post.langSwitchUrl ? 'toggle' : 'hidden';
  return {
    homeUrl,
    aboutUrl,
    blogUrl,
    langSwitchMode,
    navbarHtml: buildNavbarHtml({
      homeUrl,
      aboutUrl,
      blogUrl,
      navAboutLabel: labels.navAbout,
      navBlogLabel: labels.navBlog,
      siteTitle,
      langSwitchMode,
    }),
  };
};

const buildPostRssLinks = ({ rssEnabled, post, defaultLang, siteUrl }) =>
  rssEnabled
    ? buildRssLinks({
        lang: post.lang,
        defaultLang,
        siteUrl,
        buildUrl,
      })
    : '';

const buildPostTemplateValues = ({
  post,
  isAbout,
  siteTitle,
  metaTags,
  iconLinks,
  fontLinks,
  themeLinks,
  labels,
  sidebarHtml,
  layoutClass,
  stringifyPageData,
  commentsConfig,
  canonicalUrl,
  rssLinks,
  homeUrl,
  aboutUrl,
  blogUrl,
  langSwitchMode,
  navbarHtml,
}) => ({
  PAGE_TITLE: isAbout ? siteTitle : `${post.title} | ${siteTitle}`,
  META_TAGS: metaTags,
  RSS_LINKS: rssLinks,
  ICON_LINKS: iconLinks,
  FONT_LINKS: fontLinks,
  THEME_LINKS: themeLinks,
  NAVBAR: navbarHtml,
  LANG: post.lang,
  BODY_PAGE: isAbout ? 'about' : 'post',
  HOME_URL: homeUrl,
  ABOUT_URL: aboutUrl,
  BLOG_URL: blogUrl,
  NAV_ABOUT_LABEL: labels.navAbout,
  NAV_BLOG_LABEL: labels.navBlog,
  SITE_TITLE: siteTitle,
  ARTICLE_CONTENT: buildArticleHtml(post, { isAbout }),
  TOC: sidebarHtml,
  TOC_LAYOUT_CLASS: layoutClass,
  LANG_SWITCH_MODE: langSwitchMode,
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
  authorData,
  commentsConfig,
}) => {
  const canonicalUrl = buildUrl(siteUrl, post.url);
  const isAbout = post.translationKey === 'about';
  const { sidebarHtml, layoutClass } = resolveSidebarLayout({
    post,
    isAbout,
    authorData,
  });
  const metaTags = buildPostMetaTags({ post, siteTitle, canonicalUrl, isAbout, siteUrl });
  const renderContext = buildPostRenderContext({
    post,
    defaultLang,
    aboutGroup,
    labels,
    siteTitle,
  });
  const html = renderTemplate(
    postTemplate,
    buildPostTemplateValues({
      post,
      isAbout,
      siteTitle,
      metaTags,
      iconLinks,
      fontLinks,
      themeLinks,
      labels,
      sidebarHtml,
      layoutClass,
      stringifyPageData,
      commentsConfig,
      canonicalUrl,
      rssLinks: buildPostRssLinks({ rssEnabled, post, defaultLang, siteUrl }),
      ...renderContext,
    })
  );
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
