import { pageData } from './state.js';

const ASK_AI_ENTRY_SEEN_KEY = 'gen-blog-ask-ai-entry-seen';

const normalizeLanguage = (value) => {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw.startsWith('zh')) {
    return 'zh';
  }
  if (raw.startsWith('en')) {
    return 'en';
  }
  return null;
};

const readSeenState = () => {
  try {
    return localStorage.getItem(ASK_AI_ENTRY_SEEN_KEY) === '1';
  } catch (error) {
    return false;
  }
};

const writeSeenState = () => {
  try {
    localStorage.setItem(ASK_AI_ENTRY_SEEN_KEY, '1');
  } catch (error) {
    // ignore storage failures
  }
};

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

const prepareEntryForAskAiPage = (entry) => {
  entry.classList.add('is-active');
  entry.setAttribute('href', resolveBackUrl());
  entry.removeAttribute('target');
  entry.removeAttribute('rel');
};

const applyEntryState = (entry) => {
  if (!readSeenState()) {
    entry.classList.add('is-primed');
  }
};

const bindEntryClick = (entry) => {
  entry.addEventListener('click', () => {
    writeSeenState();
    entry.classList.remove('is-primed');
    entry.classList.add('is-acknowledged');
  });
};

export const initAskAiEntry = () => {
  const entry = document.querySelector('[data-ask-ai-entry]');
  if (!entry) {
    return;
  }

  if (pageData.pageType === 'ask-ai') {
    prepareEntryForAskAiPage(entry);
    return;
  }

  entry.setAttribute('href', buildAskAiUrl());
  applyEntryState(entry);
  bindEntryClick(entry);
};
