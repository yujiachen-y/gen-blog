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

const formatRssLanguage = (lang) => {
  if (lang === 'zh') {
    return 'zh-CN';
  }
  return 'en';
};

export const buildRssLinks = ({ lang, defaultLang, siteUrl, buildUrl }) => {
  if (!siteUrl) {
    return '';
  }
  const defaultHref = buildUrl(siteUrl, '/rss.xml');
  const langHref = buildUrl(siteUrl, `/rss-${lang}.xml`);
  const links = [
    `<link rel="alternate" type="application/rss+xml" title="RSS" href="${escapeXml(
      defaultHref
    )}" />`,
  ];
  if (lang && lang !== defaultLang) {
    links.push(
      `<link rel="alternate" type="application/rss+xml" title="RSS (${lang.toUpperCase()})" href="${escapeXml(
        langHref
      )}" />`
    );
  } else if (lang && lang === defaultLang) {
    links.push(
      `<link rel="alternate" type="application/rss+xml" title="RSS (${lang.toUpperCase()})" href="${escapeXml(
        langHref
      )}" />`
    );
  }
  return links.join('\n');
};

export const buildRssFeed = ({
  siteTitle,
  siteUrl,
  lang,
  defaultLang,
  items,
  feedUrl,
  buildUrl,
  buildListUrl,
  absolutizeHtml,
}) => {
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
