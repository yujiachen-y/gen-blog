import { pageData } from './state.js';
import {
  collapseWhitespace,
  normalizeAuthorName,
  parseDate,
  formatIsoDate,
  buildBibtexKey,
  buildApaCitation,
  buildBibtexCitation,
} from './citation-format.js';

const citationLabels = {
  en: {
    title: 'CITE THIS ARTICLE',
    expand: 'Show citation',
    collapse: 'Hide citation',
    copy: 'Copy',
    copied: 'Copied',
    apa: 'APA',
    bibtex: 'BibTeX',
  },
  zh: {
    title: '引用本文',
    expand: '展开引用',
    collapse: '收起引用',
    copy: '复制',
    copied: '已复制',
    apa: 'APA',
    bibtex: 'BibTeX',
  },
};

const fallbackCopy = (value) => {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
};

const copyText = async (value) => {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // fallback to execCommand below.
    }
  }
  return fallbackCopy(value);
};

const buildCitationBlock = ({ title, text, labels }) => {
  const block = document.createElement('article');
  block.className = 'citation-block';

  const header = document.createElement('div');
  header.className = 'citation-header';

  const formatTitle = document.createElement('div');
  formatTitle.className = 'citation-format';
  formatTitle.textContent = title;

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'citation-copy';
  copyButton.textContent = labels.copy;
  copyButton.addEventListener('click', async () => {
    const copied = await copyText(text);
    if (!copied) {
      return;
    }
    copyButton.textContent = labels.copied;
    copyButton.classList.add('is-copied');
    window.setTimeout(() => {
      copyButton.textContent = labels.copy;
      copyButton.classList.remove('is-copied');
    }, 1400);
  });

  header.append(formatTitle, copyButton);

  const code = document.createElement('pre');
  code.className = 'citation-code';
  code.textContent = text;

  block.append(header, code);
  return block;
};

const resolvePageTitle = () =>
  collapseWhitespace(
    pageData.comments?.pageTitle || document.querySelector('.article-hero')?.textContent
  );

const resolvePageUrl = () =>
  collapseWhitespace(
    document.querySelector('link[rel="canonical"]')?.getAttribute('href') ||
      pageData.comments?.pageUrl ||
      window.location.href
  );

const resolveSiteTitle = () => {
  const fromBrand = collapseWhitespace(document.querySelector('.brand')?.textContent);
  if (fromBrand) {
    return fromBrand;
  }
  const parts = collapseWhitespace(document.title).split(' | ').filter(Boolean);
  return collapseWhitespace(parts[parts.length - 1]);
};

const resolvePublishedAt = () => {
  const metaLabel = collapseWhitespace(document.querySelector('.article-date')?.textContent);
  const matched = metaLabel.match(/\d{4}-\d{2}-\d{2}/);
  return parseDate(matched ? matched[0] : '');
};

const resolveTranslationKey = () => {
  const fromComments = collapseWhitespace(pageData.comments?.pageId);
  if (fromComments) {
    return fromComments;
  }
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (!path) {
    return 'post';
  }
  const [firstSegment] = path.split('/');
  return collapseWhitespace(firstSegment) || 'post';
};

const buildCitationToolbar = ({ labels, blocks }) => {
  const toolbar = document.createElement('div');
  toolbar.className = 'citation-toolbar';

  const label = document.createElement('div');
  label.className = 'citation-label';
  label.textContent = labels.title;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'citation-toggle';

  let expanded = false;
  const applyExpandedState = () => {
    blocks.hidden = !expanded;
    toggle.textContent = expanded ? labels.collapse : labels.expand;
    toggle.setAttribute('aria-expanded', String(expanded));
  };

  toggle.addEventListener('click', () => {
    expanded = !expanded;
    applyExpandedState();
  });

  applyExpandedState();
  toolbar.append(label, toggle);
  return toolbar;
};

export const initCitation = () => {
  if (pageData.pageType !== 'post') {
    return;
  }

  const section = document.querySelector('[data-citation-section]');
  if (!section) {
    return;
  }

  const lang = pageData.lang === 'zh' ? 'zh' : 'en';
  const labels = citationLabels[lang];
  const title = resolvePageTitle();
  const pageUrl = resolvePageUrl();
  const siteTitle = resolveSiteTitle();
  const publishedAt = resolvePublishedAt();
  const translationKey = resolveTranslationKey();
  const authorInfo = normalizeAuthorName(siteTitle);
  const year = publishedAt ? String(publishedAt.getUTCFullYear()) : 'n.d.';
  const accessDate = formatIsoDate(new Date());

  if (!title || !pageUrl || !siteTitle) {
    return;
  }

  const bibtexKey = buildBibtexKey({
    authorFamily: authorInfo.family,
    year,
    translationKey,
    title,
  });
  const apaCitation = buildApaCitation({
    author: authorInfo.apa,
    date: publishedAt,
    title,
    siteTitle,
    pageUrl,
    lang,
  });
  const bibtexCitation = buildBibtexCitation({
    key: bibtexKey,
    author: authorInfo.bibtex,
    title,
    year,
    pageUrl,
    siteTitle,
    accessDate,
  });

  if (!apaCitation || !bibtexCitation) {
    return;
  }

  const blocks = document.createElement('div');
  blocks.className = 'citation-blocks';
  blocks.append(
    buildCitationBlock({ title: labels.apa, text: apaCitation, labels }),
    buildCitationBlock({ title: labels.bibtex, text: bibtexCitation, labels })
  );

  section.append(buildCitationToolbar({ labels, blocks }), blocks);
};
