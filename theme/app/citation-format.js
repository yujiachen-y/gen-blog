export const collapseWhitespace = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const splitWords = (value) => collapseWhitespace(value).split(' ').filter(Boolean);

const toInitials = (value) =>
  splitWords(value)
    .map((word) => word.charAt(0).toUpperCase())
    .filter(Boolean)
    .map((char) => `${char}.`)
    .join(' ');

export const normalizeAuthorName = (value) => {
  const raw = collapseWhitespace(value);
  if (!raw) {
    return { apa: 'Unknown', bibtex: 'Unknown', family: 'author' };
  }
  if (raw.includes(',')) {
    const [familyPart, ...rest] = raw.split(',');
    const family = collapseWhitespace(familyPart);
    const given = collapseWhitespace(rest.join(' '));
    const initials = toInitials(given);
    return {
      apa: family && initials ? `${family}, ${initials}` : raw,
      bibtex: family && given ? `${family}, ${given}` : raw,
      family: family || raw,
    };
  }
  const tokens = splitWords(raw);
  if (tokens.length < 2) {
    return { apa: raw, bibtex: raw, family: raw };
  }
  const family = tokens[tokens.length - 1];
  const given = tokens.slice(0, -1).join(' ');
  const initials = toInitials(given);
  return {
    apa: initials ? `${family}, ${initials}` : family,
    bibtex: `${family}, ${given}`,
    family,
  };
};

export const parseDate = (value) => {
  const raw = collapseWhitespace(value).slice(0, 10);
  if (!raw) {
    return null;
  }
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatReadableDate = (date, lang) => {
  if (!date) {
    return lang === 'zh' ? '无日期' : 'n.d.';
  }
  if (lang === 'zh') {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${year}年${month}月${day}日`;
  }
  const month = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(date);
  return `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
};

export const formatIsoDate = (date) => date.toISOString().slice(0, 10);

const escapeBibtexValue = (value) => collapseWhitespace(value).replace(/[{}]/g, '');

const slugifyToken = (value) =>
  collapseWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export const buildBibtexKey = ({ authorFamily, year, translationKey, title }) => {
  const familyToken = slugifyToken(authorFamily) || 'author';
  const yearToken = /^\d{4}$/.test(year) ? year : 'nodate';
  const sourceToken = slugifyToken(translationKey || title).slice(0, 28) || 'article';
  return `${familyToken}${yearToken}${sourceToken}`;
};

export const buildApaCitation = ({ author, date, title, siteTitle, pageUrl, lang }) => {
  if (!title || !pageUrl) {
    return '';
  }
  const dateLabel = formatReadableDate(date, lang);
  const siteLabel = collapseWhitespace(siteTitle);
  const prefix = `${author} (${dateLabel}). ${title}.`;
  return siteLabel ? `${prefix} ${siteLabel}. ${pageUrl}` : `${prefix} ${pageUrl}`;
};

export const buildBibtexCitation = ({
  key,
  author,
  title,
  year,
  pageUrl,
  siteTitle,
  accessDate,
}) => {
  if (!title || !pageUrl) {
    return '';
  }
  const safeTitle = escapeBibtexValue(title);
  const safeSiteTitle = escapeBibtexValue(siteTitle);
  const safeAuthor = escapeBibtexValue(author);
  const safeUrl = escapeBibtexValue(pageUrl);
  const safeYear = /^\d{4}$/.test(year) ? year : 'n.d.';
  const safeAccessDate = escapeBibtexValue(accessDate);
  const publisherLine = safeSiteTitle ? `  publisher = {${safeSiteTitle}},` : null;
  return [
    `@online{${key},`,
    `  author = {${safeAuthor}},`,
    `  title = {${safeTitle}},`,
    `  year = {${safeYear}},`,
    publisherLine,
    `  url = {${safeUrl}},`,
    `  urldate = {${safeAccessDate}},`,
    '}',
  ]
    .filter(Boolean)
    .join('\n');
};
