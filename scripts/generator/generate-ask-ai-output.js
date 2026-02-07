import path from 'node:path';
import { buildMetaForList } from '../content/pages.js';
import { buildNavbarHtml } from '../content/layout.js';
import { writePage } from '../shared/fs-utils.js';
import { renderTemplate } from '../shared/templates.js';
import { buildAboutUrl, buildHomeUrl, buildListUrl, buildUrl } from '../shared/paths.js';

const buildAskAiPageData = ({ lang, labels }) => ({
  pageType: 'ask-ai',
  lang,
  langSwitchUrl: null,
  langSwitcherMode: 'toggle',
  labels: {
    navAbout: labels.navAbout,
    navBlog: labels.navBlog,
    filterAll: labels.filterAll,
  },
});

export const writeAskAiPage = async ({
  askAiTemplate,
  buildDir,
  siteTitle,
  siteUrl,
  defaultLang,
  aboutGroup,
  labels,
  iconLinks,
  fontLinks,
  themeLinks,
  stringifyPageData,
}) => {
  const pageLang = defaultLang || 'en';
  const pageUrl = '/ask-ai/';
  const homeUrl = buildHomeUrl(pageLang, pageLang);
  const aboutUrl = buildAboutUrl(pageLang, pageLang, aboutGroup);
  const blogUrl = buildListUrl(pageLang, pageLang);
  const navbarHtml = buildNavbarHtml({
    homeUrl,
    aboutUrl,
    blogUrl,
    navAboutLabel: labels.navAbout,
    navBlogLabel: labels.navBlog,
    siteTitle,
    langSwitchMode: 'hidden',
  });
  const html = renderTemplate(askAiTemplate, {
    PAGE_TITLE: `Ask AI | ${siteTitle}`,
    META_TAGS: buildMetaForList({
      siteTitle: `Ask AI | ${siteTitle}`,
      description: 'Open LLM apps with a transparent prompt based on this blog context.',
      canonicalUrl: buildUrl(siteUrl, pageUrl),
      prevUrl: null,
      nextUrl: null,
      hreflangLinks: '',
    }),
    RSS_LINKS: '',
    ICON_LINKS: iconLinks,
    FONT_LINKS: fontLinks,
    THEME_LINKS: themeLinks,
    NAVBAR: navbarHtml,
    LANG: pageLang,
    PAGE_DATA: stringifyPageData(
      buildAskAiPageData({
        lang: pageLang,
        labels,
      })
    ),
  });
  await writePage(path.join(buildDir, 'ask-ai'), html);
};
