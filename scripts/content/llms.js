import { buildHomeUrl, buildListUrl, buildUrl } from '../shared/paths.js';

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

export const buildLlmsTxt = ({ siteTitle, siteUrl, defaultLang, originPages, listDataByLang }) => {
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
