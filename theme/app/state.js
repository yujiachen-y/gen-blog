import { normalizeLanguage } from './language.js';

const pageDataEl = document.getElementById('page-data');
export const pageData = pageDataEl ? JSON.parse(pageDataEl.textContent || '{}') : {};
export const uiLabels = pageData.labels || {};

const resolveAskAiQueryLanguage = () => {
  if (pageData.pageType !== 'ask-ai') {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  return normalizeLanguage(params.get('ui')) || null;
};

const resolvedInitialLanguage =
  resolveAskAiQueryLanguage() || normalizeLanguage(pageData.lang) || 'en';
pageData.lang = resolvedInitialLanguage;

export const grid = document.getElementById('grid-container');
export const filterPills = document.getElementById('filter-pills');
export const themeSwitchers = Array.from(document.querySelectorAll('[data-theme-switcher]'));
export const langSwitchers = Array.from(document.querySelectorAll('[data-lang-switcher]'));
export const searchInput = document.getElementById('search-input');

export const themeStorageKey = 'gen-blog-theme';
export const languageStorageKey = 'gen-blog-lang';
export const filterStorageKey = 'gen-blog-filter';
export const scrollStorageKey = 'gen-blog-scroll';

export const state = {
  filter: 'all',
  filterIndex: [],
  categories: [],
  initialPosts: pageData.posts || [],
  language: resolvedInitialLanguage,
  searchQuery: '',
  fuseInstance: null,
};

const getScrollKey = () => `${scrollStorageKey}:${state.language}`;

export const saveScrollPosition = () => {
  if (pageData.pageType !== 'list') {
    return;
  }
  localStorage.setItem(getScrollKey(), String(window.scrollY || 0));
};

export const restoreScrollPosition = () => {
  if (pageData.pageType !== 'list') {
    return;
  }
  const stored = localStorage.getItem(getScrollKey());
  if (!stored) {
    return;
  }
  const value = Number(stored);
  if (Number.isNaN(value)) {
    return;
  }
  window.scrollTo(0, value);
};

export const getStoredFilter = (lang) => {
  if (!lang) {
    return null;
  }
  return localStorage.getItem(`${filterStorageKey}:${lang}`);
};

export const setStoredFilter = (lang, slug) => {
  if (!lang) {
    return;
  }
  localStorage.setItem(`${filterStorageKey}:${lang}`, slug);
};
