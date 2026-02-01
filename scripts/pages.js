import { escapeHtml } from './templates.js';

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

export const buildArticleHtml = (post) => {
  const coverHtml = post.coverPicture
    ? `\n<div class="article-cover">${buildPictureHtml(post.coverPicture, {
        alt: post.title,
        imgClass: 'article-cover-image',
      })}<div class="article-cover-overlay"></div></div>\n`
    : '';

  const categoryLabel = post.categories.map((cat) => cat.toUpperCase()).join(' · ');

  return `\n${coverHtml}\n<div class="article-text-content">\n  <div class="article-date">${escapeHtml(post.date)} · ${escapeHtml(
    categoryLabel
  )}</div>\n  <h1 class="article-hero">${escapeHtml(post.title)}</h1>\n  <div class="article-body">${post.contentHtml}</div>\n</div>\n`;
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
