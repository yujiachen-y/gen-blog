import { pageData } from './state.js';
import { normalizeLanguage } from './language.js';

const resolveArticleTitle = () => {
  const heading = document.querySelector('.article-hero');
  if (!heading || !heading.textContent) {
    return '';
  }
  return heading.textContent.trim();
};

const resolveUiLanguage = () =>
  normalizeLanguage(pageData.lang) ||
  normalizeLanguage(document.documentElement.getAttribute('lang')) ||
  'en';

const buildAskAiUrl = () => {
  const params = new URLSearchParams();
  const pageType = pageData.pageType === 'post' ? 'post' : 'base';
  const currentPath = window.location.pathname || '/';
  const uiLang = resolveUiLanguage();

  params.set('ui', uiLang);
  params.set('from', pageType);
  params.set('src', currentPath);
  params.set('lang', normalizeLanguage(pageData.lang) || uiLang);

  if (pageType === 'post') {
    const title = resolveArticleTitle();
    if (title) {
      params.set('title', title);
    }
    const markdownPath = String(pageData.markdownUrl || '').trim();
    if (markdownPath && markdownPath.startsWith('/')) {
      params.set('md', markdownPath);
    }
  }

  return `/ask-ai/?${params.toString()}`;
};

const resolveBackUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const src = (params.get('src') || '').trim();
  if (src && src !== '/' && src.startsWith('/')) {
    return src;
  }
  try {
    const ref = new URL(document.referrer);
    if (ref.origin === window.location.origin && ref.pathname !== '/ask-ai/') {
      return ref.pathname + ref.search;
    }
  } catch {
    // invalid or empty referrer
  }
  return '/';
};

const resolveEntryHref = () =>
  pageData.pageType === 'ask-ai' ? resolveBackUrl() : buildAskAiUrl();

export const initAskAiEntry = () => {
  const entry = document.querySelector('[data-ask-ai-entry]');
  if (!entry) {
    return;
  }

  entry.classList.toggle('is-active', pageData.pageType === 'ask-ai');
  entry.setAttribute('href', resolveEntryHref());
  entry.removeAttribute('target');
  entry.removeAttribute('rel');
};
