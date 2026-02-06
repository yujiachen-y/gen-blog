import { escapeHtml } from '../shared/templates.js';

export const buildPictureHtml = (picture, options = {}) => {
  if (!picture) {
    return '';
  }

  const { alt = '', pictureClass = '', imgClass = '', loading = null } = options;
  const altText = escapeHtml(alt);
  const width = picture.img.width ? ` width="${picture.img.width}"` : '';
  const height = picture.img.height ? ` height="${picture.img.height}"` : '';
  const loadingAttr = loading ? ` loading="${loading}"` : '';
  const pictureClassAttr = pictureClass ? ` class="${pictureClass}"` : '';
  const imgClassAttr = imgClass ? ` class="${imgClass}"` : '';

  return `\n<picture${pictureClassAttr}>\n  <source srcset="${picture.sources[0].src}" type="${picture.sources[0].type}" />\n  <img src="${picture.img.src}" alt="${altText}"${imgClassAttr}${width}${height}${loadingAttr} />\n</picture>\n`;
};

const SOCIAL_LABELS = {
  email: 'Email',
  x: 'X',
  github: 'GitHub',
  xiaohongshu: '小红书',
  rss: 'RSS',
};

const SOCIAL_ICON_ATTRS =
  'viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

const SOCIAL_ICONS = {
  email: `<svg ${SOCIAL_ICON_ATTRS}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></svg>`,
  x: `<svg ${SOCIAL_ICON_ATTRS}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>`,
  github: `<svg ${SOCIAL_ICON_ATTRS}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>`,
  xiaohongshu: `<svg ${SOCIAL_ICON_ATTRS}><path d="M2 4h6a4 4 0 0 1 4 4v12a4 4 0 0 0-4-4H2z" /><path d="M22 4h-6a4 4 0 0 0-4 4v12a4 4 0 0 1 4-4h6z" /></svg>`,
  rss: `<svg ${SOCIAL_ICON_ATTRS}><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" /></svg>`,
};

const isHttpUrl = (value) => /^https?:\/\//i.test(value);

const normalizeHandle = (value) => value.replace(/^@/, '');

const SOCIAL_URL_BUILDERS = {
  email: (value) => (value.startsWith('mailto:') ? value : `mailto:${value}`),
  x: (value) => (isHttpUrl(value) ? value : `https://x.com/${normalizeHandle(value)}`),
  github: (value) => (isHttpUrl(value) ? value : `https://github.com/${normalizeHandle(value)}`),
  xiaohongshu: (value) =>
    isHttpUrl(value) ? value : `https://www.xiaohongshu.com/user/profile/${normalizeHandle(value)}`,
  rss: (value) => value,
};

const buildSocialUrl = (type, value) => {
  if (!value) {
    return '';
  }
  const builder = SOCIAL_URL_BUILDERS[type];
  return builder ? builder(value) : '';
};

export const buildSocialLinksHtml = (social) => {
  if (!Array.isArray(social) || social.length === 0) {
    return '';
  }
  const links = social
    .map((entry) => {
      if (!entry) {
        return '';
      }
      const label = entry.label || SOCIAL_LABELS[entry.type] || entry.type;
      const url = buildSocialUrl(entry.type, entry.value);
      if (!label || !url) {
        return '';
      }
      const icon = SOCIAL_ICONS[entry.type] || '';
      const iconHtml = icon ? `<span class="about-social-icon">${icon}</span>` : '';
      const labelHtml = `<span class="about-social-link-text">${escapeHtml(label)}</span>`;
      return `\n  <a class="about-social-link" href="${escapeHtml(
        url
      )}" aria-label="${escapeHtml(label)}">${iconHtml}${labelHtml}</a>`;
    })
    .filter(Boolean)
    .join('');

  if (!links) {
    return '';
  }

  return `\n<div class="about-social">${links}\n</div>\n`;
};

export const buildAuthorHtml = (authorConfig) => {
  if (!authorConfig) {
    return '';
  }
  const avatarUrl = authorConfig.avatarUrl ? escapeHtml(authorConfig.avatarUrl) : '';
  const avatarHtml = avatarUrl
    ? `\n  <div class="about-avatar">\n    <img src="${avatarUrl}" alt="Avatar" />\n  </div>\n`
    : '';
  const socialHtml = buildSocialLinksHtml(authorConfig.social || []);
  if (!avatarHtml && !socialHtml) {
    return '';
  }
  const classes = [
    'about-author',
    avatarHtml ? 'has-avatar' : 'no-avatar',
    socialHtml ? 'has-social' : 'no-social',
  ]
    .filter(Boolean)
    .join(' ');
  return `\n<section class="${classes}">${avatarHtml}${socialHtml}\n</section>\n`;
};

export const buildArticleHtml = (post, options = {}) => {
  const { isAbout = false, authorHtml = '' } = options;
  const coverHtml = post.coverPicture
    ? `\n<div class="article-cover">${buildPictureHtml(post.coverPicture, {
        alt: post.title,
        imgClass: 'article-cover-image',
      })}<div class="article-cover-overlay"></div></div>\n`
    : '';

  const categoryLabel = Array.isArray(post.categories)
    ? post.categories.map((cat) => cat.toUpperCase()).join(' · ')
    : '';
  const metaLabel = [post.date || '', categoryLabel].filter(Boolean).join(' · ');
  const metaHtml =
    !isAbout && metaLabel ? `\n  <div class="article-date">${escapeHtml(metaLabel)}</div>` : '';
  const authorSection = isAbout && authorHtml ? `\n  ${authorHtml}` : '';

  return `\n${coverHtml}\n<div class="article-text-content">${metaHtml}\n  <h1 class="article-hero">${escapeHtml(
    post.title
  )}</h1>${authorSection}\n  <div class="article-body">${post.contentHtml}</div>\n</div>\n`;
};

export const buildTocHtml = (tocItems, lang) => {
  if (!tocItems || tocItems.length === 0) {
    return '';
  }
  const title = lang === 'zh' ? '目录' : 'Contents';
  const items = tocItems
    .map(
      (item) =>
        `\n      <li class="toc-item toc-level-${item.level}"><a href="#${escapeHtml(
          item.id
        )}">${escapeHtml(item.text || item.id)}</a></li>`
    )
    .join('');
  return `\n    <aside class="article-toc" data-toc>\n      <button class="toc-toggle" type="button" data-toc-toggle aria-expanded="false">\n        <span class="toc-toggle-label">${escapeHtml(title)}</span>\n        <span class="toc-toggle-icon" aria-hidden="true">⌄</span>\n      </button>\n      <div class="toc-panel" data-toc-panel>\n        <div class="toc-title">${escapeHtml(title)}</div>\n        <ol class="toc-list">${items}\n        </ol>\n      </div>\n    </aside>\n  `;
};

const formatShortDate = (dateStr) => {
  if (!dateStr || dateStr.length < 10) {
    return dateStr || '';
  }
  return dateStr.slice(5);
};

export const buildCardHtml = (post, sortedCategoryNames) => {
  const categoryLabel = post.categories[0] || 'General';
  const catIndex = sortedCategoryNames ? sortedCategoryNames.indexOf(categoryLabel) % 5 : 0;
  const dataCat = catIndex === -1 ? 0 : catIndex;
  const coverHtml = post.coverPicture
    ? buildPictureHtml(post.coverPicture, {
        alt: post.title,
        imgClass: 'card-image',
        loading: 'lazy',
      })
    : '';
  const shortDate = formatShortDate(post.date);

  return `\n<a class="card${post.coverPicture ? ' has-image' : ''}" href="${post.url}">\n  <div class="card-content-wrapper">\n    <div class="card-title" data-cat="${dataCat}" data-category-name="${escapeHtml(
    categoryLabel
  )}">${escapeHtml(post.title)}</div>\n    <span class="card-date">${escapeHtml(
    shortDate
  )}</span>\n  </div>\n  ${coverHtml}\n</a>\n`;
};

export const buildListSectionsHtml = (items, sortedCategoryNames) => {
  const groups = [];
  items.forEach((item) => {
    const year = item.date ? item.date.slice(0, 4) : 'Unknown';
    const current = groups[groups.length - 1];
    if (!current || current.year !== year) {
      groups.push({ year, items: [item] });
    } else {
      current.items.push(item);
    }
  });

  return groups
    .map((group) => {
      const cards = group.items.map((item) => buildCardHtml(item, sortedCategoryNames)).join('');
      return `\n<section class="year-section">\n  <h2 class="year-heading">${escapeHtml(
        group.year
      )}</h2>\n  <div class="year-posts">${cards}</div>\n</section>\n`;
    })
    .join('');
};

const buildMetaTags = (tags) =>
  tags
    .filter(Boolean)
    .map((tag) => `    ${tag}`)
    .join('\n');

export const buildHreflangLinks = (translations) => {
  const entries = Object.entries(translations).map(
    ([lang, url]) => `<link rel="alternate" hreflang="${lang}" href="${url}" />`
  );
  return entries.join('\n');
};

const buildCanonical = (url) => `<link rel="canonical" href="${url}" />`;

export const buildMetaForPost = ({
  post,
  siteTitle,
  canonicalUrl,
  hreflangLinks,
  baseUrl,
  buildUrl,
}) => {
  const description = escapeHtml(post.title);
  const title = escapeHtml(`${post.title} | ${siteTitle}`);
  const ogImageSrc = post.coverPicture?.img?.src
    ? buildUrl(baseUrl, post.coverPicture.img.src)
    : null;
  const ogImage = ogImageSrc ? `<meta property="og:image" content="${ogImageSrc}" />` : '';
  const twitterCard = post.coverPicture ? 'summary_large_image' : 'summary';

  return buildMetaTags([
    `<meta name="description" content="${description}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    ogImage,
    `<meta name="twitter:card" content="${twitterCard}" />`,
    buildCanonical(canonicalUrl),
    hreflangLinks,
  ]);
};

export const buildMetaForList = ({
  siteTitle,
  description,
  canonicalUrl,
  prevUrl,
  nextUrl,
  hreflangLinks,
}) =>
  buildMetaTags([
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:title" content="${escapeHtml(siteTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    buildCanonical(canonicalUrl),
    prevUrl ? `<link rel="prev" href="${prevUrl}" />` : '',
    nextUrl ? `<link rel="next" href="${nextUrl}" />` : '',
    hreflangLinks,
  ]);
