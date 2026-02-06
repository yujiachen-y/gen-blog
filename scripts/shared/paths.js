import path from 'node:path';

export const slugifySegment = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const slugifyPath = (value) =>
  value
    .split(/[\\/]+/)
    .map(slugifySegment)
    .filter(Boolean)
    .join('/');

export const slugifyHeading = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

export const resolveTranslationKey = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }
  const slugged = slugifyPath(raw);
  if (!slugged || slugged !== raw) {
    return null;
  }
  return raw;
};

export const buildPostAssetDir = (post) =>
  path.posix.join('posts', post.translationKey, post.lang || post.defaultLang || 'unknown');

export const buildPostImagePath = (post, index) =>
  path.posix.join(buildPostAssetDir(post), `image_${index}`);

export const buildPostCoverPath = (post) => path.posix.join(buildPostAssetDir(post), 'cover');

export const buildPostMarkdownPath = (translationKey) =>
  `/${path.posix.join('posts', translationKey, 'post.md')}`;

export const buildUrl = (baseUrl, pathName) => {
  if (!baseUrl) {
    return pathName;
  }
  const trimmed = baseUrl.replace(/\/$/, '');
  return `${trimmed}${pathName}`;
};

const LIST_BASE = '/blog';

export const buildHomeUrl = (lang, defaultLang) => {
  const prefix = lang === defaultLang ? '' : `/${lang}`;
  return `${prefix}/` || '/';
};

export const buildPostUrl = (translationKey, lang, defaultLang) => {
  const langSegment = lang === defaultLang ? '' : `/${lang}`;
  return `/${translationKey}${langSegment}/`;
};

export const buildListUrl = (lang, defaultLang) => {
  const langSegment = lang === defaultLang ? '' : `/${lang}`;
  return `${LIST_BASE}${langSegment}/`;
};

export const buildAboutUrl = (lang, defaultLang, aboutGroup) => {
  if (!aboutGroup) {
    return buildListUrl(lang, defaultLang);
  }
  const targetLang = aboutGroup.languages.includes(lang) ? lang : aboutGroup.defaultLang;
  return buildPostUrl('about', targetLang, aboutGroup.defaultLang);
};

export const stripLeadingSlash = (value) => (value.startsWith('/') ? value.slice(1) : value);
