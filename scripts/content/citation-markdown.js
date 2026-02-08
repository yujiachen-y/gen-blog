import {
  collapseWhitespace,
  normalizeAuthorName,
  parseDate,
  formatIsoDate,
  buildBibtexKey,
  buildApaCitation,
  buildBibtexCitation,
} from '../../theme/app/citation-format.js';

const resolveLabels = (lang) => {
  if (lang === 'zh') {
    return {
      heading: '## 引用本文',
      apa: 'APA：',
      bibtex: 'BibTeX：',
    };
  }
  return {
    heading: '## Cite this article',
    apa: 'APA:',
    bibtex: 'BibTeX:',
  };
};

export const buildCitationMarkdown = ({ post, siteTitle, siteUrl, buildUrl }) => {
  const title = collapseWhitespace(post.title);
  const site = collapseWhitespace(siteTitle);
  if (!title || !site || !siteUrl || !post.url) {
    return '';
  }
  const pageUrl = buildUrl(siteUrl, post.url);
  if (!pageUrl) {
    return '';
  }

  const labels = resolveLabels(post.lang);
  const authorInfo = normalizeAuthorName(site);
  const publishedAt = parseDate(post.date);
  const year = publishedAt ? String(publishedAt.getUTCFullYear()) : 'n.d.';
  const accessDate = formatIsoDate(new Date());
  const key = buildBibtexKey({
    authorFamily: authorInfo.family,
    year,
    translationKey: post.translationKey,
    title,
  });
  const apa = buildApaCitation({
    author: authorInfo.apa,
    date: publishedAt,
    title,
    siteTitle: site,
    pageUrl,
    lang: post.lang,
  });
  const bibtex = buildBibtexCitation({
    key,
    author: authorInfo.bibtex,
    title,
    year,
    siteTitle: site,
    pageUrl,
    accessDate,
  });

  return [labels.heading, '', labels.apa, apa, '', labels.bibtex, '```bibtex', bibtex, '```'].join(
    '\n'
  );
};
