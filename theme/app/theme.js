import {
  pageData,
  state,
  themeSwitchers,
  langSwitchers,
  themeStorageKey,
  languageStorageKey,
  saveScrollPosition,
} from './state.js';
import { normalizeLanguage } from './language.js';

const themeModes = ['dark', 'light'];
const themeOverrideTtlMs = 24 * 60 * 60 * 1000;
const themeOverrideHint = 'Manual selection expires in 24 hours.';
const themeMediaQuery =
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
let themeOverrideExpiryTimer = null;

const normalizeThemeMode = (mode) => (themeModes.includes(mode) ? mode : null);

const getThemeLabel = (mode) => mode.charAt(0).toUpperCase() + mode.slice(1);

const getSystemThemeMode = () => (themeMediaQuery && themeMediaQuery.matches ? 'dark' : 'light');

const getNextThemeMode = (mode) => (mode === 'dark' ? 'light' : 'dark');

const clearThemeOverrideExpiryTimer = () => {
  if (!themeOverrideExpiryTimer) {
    return;
  }
  window.clearTimeout(themeOverrideExpiryTimer);
  themeOverrideExpiryTimer = null;
};

const updateThemeToggles = (mode) => {
  const labelText = getThemeLabel(mode);
  const nextMode = getNextThemeMode(mode);
  const nextLabelText = getThemeLabel(nextMode);
  themeSwitchers.forEach((switcher) => {
    switcher.dataset.themeState = mode;
    const trigger = switcher.querySelector('[data-theme-trigger]');
    if (trigger) {
      trigger.setAttribute(
        'aria-label',
        `Theme mode: ${labelText}. Click to switch to ${nextLabelText}. ${themeOverrideHint}`
      );
      trigger.setAttribute('aria-pressed', mode === 'dark');
    }
  });
};

const applyThemeMode = (mode) => {
  const normalizedMode = normalizeThemeMode(mode) || getSystemThemeMode();
  document.documentElement.setAttribute('data-theme', normalizedMode);
  updateThemeToggles(normalizedMode);
  return normalizedMode;
};

const serializeThemeOverride = (mode, expiresAt) => JSON.stringify({ mode, expiresAt });

const setThemeOverride = (mode, expiresAt) => {
  const normalizedMode = normalizeThemeMode(mode);
  if (!normalizedMode || !Number.isFinite(expiresAt)) {
    return;
  }
  localStorage.setItem(themeStorageKey, serializeThemeOverride(normalizedMode, expiresAt));
};

const clearThemeOverride = () => {
  localStorage.removeItem(themeStorageKey);
  clearThemeOverrideExpiryTimer();
};

const scheduleThemeOverrideExpiry = (expiresAt) => {
  clearThemeOverrideExpiryTimer();
  if (!Number.isFinite(expiresAt)) {
    return;
  }
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) {
    clearThemeOverride();
    applyThemeMode(getSystemThemeMode());
    return;
  }
  themeOverrideExpiryTimer = window.setTimeout(() => {
    clearThemeOverride();
    applyThemeMode(getSystemThemeMode());
  }, remainingMs);
};

const parseThemeOverride = (rawValue) => {
  if (!rawValue) {
    return null;
  }
  const isLegacyMode = normalizeThemeMode(rawValue);
  if (isLegacyMode) {
    return { mode: isLegacyMode, expiresAt: Date.now() + themeOverrideTtlMs };
  }
  try {
    const parsed = JSON.parse(rawValue);
    if (typeof parsed === 'string') {
      const parsedLegacyMode = normalizeThemeMode(parsed);
      if (!parsedLegacyMode) {
        return null;
      }
      return { mode: parsedLegacyMode, expiresAt: Date.now() + themeOverrideTtlMs };
    }
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const mode = normalizeThemeMode(parsed.mode);
    const expiresAt = Number(parsed.expiresAt);
    if (!mode || !Number.isFinite(expiresAt)) {
      return null;
    }
    return { mode, expiresAt };
  } catch (error) {
    return null;
  }
};

const getThemeOverride = () => {
  const rawValue = localStorage.getItem(themeStorageKey);
  if (!rawValue) {
    return null;
  }
  const parsedOverride = parseThemeOverride(rawValue);
  if (!parsedOverride) {
    clearThemeOverride();
    return null;
  }
  if (parsedOverride.expiresAt <= Date.now()) {
    clearThemeOverride();
    return null;
  }
  const serialized = serializeThemeOverride(parsedOverride.mode, parsedOverride.expiresAt);
  if (serialized !== rawValue) {
    localStorage.setItem(themeStorageKey, serialized);
  }
  return parsedOverride;
};

const initTheme = () => {
  const themeOverride = getThemeOverride();
  if (themeOverride) {
    applyThemeMode(themeOverride.mode);
    scheduleThemeOverrideExpiry(themeOverride.expiresAt);
    return;
  }
  applyThemeMode(getSystemThemeMode());
  clearThemeOverrideExpiryTimer();
};

const updateLangSwitchers = (lang) => {
  langSwitchers.forEach((switcher) => {
    const toggle = switcher.querySelector('[data-lang-toggle]');
    if (!toggle) {
      return;
    }
    toggle.textContent = lang === 'zh' ? '中文' : 'EN';
    toggle.setAttribute('aria-label', `Switch language (current ${lang})`);
    toggle.setAttribute('aria-pressed', lang === 'zh');
  });
};

const setLangSwitcherVisibility = () => {
  const mode = pageData.langSwitcherMode || 'toggle';
  langSwitchers.forEach((switcher) => {
    switcher.classList.toggle('is-hidden', mode === 'hidden');
  });
};

const setLanguagePreference = (lang) => {
  const normalized = normalizeLanguage(lang);
  if (normalized) {
    localStorage.setItem(languageStorageKey, normalized);
  }
};

const buildAskAiLanguageSwitchUrl = (targetLang) => {
  const params = new URLSearchParams(window.location.search);
  params.set('ui', targetLang);
  if (!params.get('from')) {
    params.set('from', 'base');
  }
  if (!params.get('src')) {
    params.set('src', window.location.pathname || '/ask-ai/');
  }
  return `/ask-ai/?${params.toString()}`;
};

const toggleThemeMode = () => {
  const currentThemeMode =
    normalizeThemeMode(document.documentElement.getAttribute('data-theme')) || getSystemThemeMode();
  const nextThemeMode = getNextThemeMode(currentThemeMode);
  applyThemeMode(nextThemeMode);
  const expiresAt = Date.now() + themeOverrideTtlMs;
  setThemeOverride(nextThemeMode, expiresAt);
  scheduleThemeOverrideExpiry(expiresAt);
};

const handleSystemThemeChange = (event) => {
  clearThemeOverride();
  applyThemeMode(event && event.matches ? 'dark' : 'light');
};

const initSystemThemeSync = () => {
  if (!themeMediaQuery) {
    return;
  }
  if (typeof themeMediaQuery.addEventListener === 'function') {
    themeMediaQuery.addEventListener('change', handleSystemThemeChange);
    return;
  }
  if (typeof themeMediaQuery.addListener === 'function') {
    themeMediaQuery.addListener(handleSystemThemeChange);
  }
};

const initLangSwitchers = () => {
  langSwitchers.forEach((switcher) => {
    const toggle = switcher.querySelector('[data-lang-toggle]');
    if (!toggle) {
      return;
    }
    toggle.addEventListener('click', () => {
      const nextLang = state.language === 'zh' ? 'en' : 'zh';
      saveScrollPosition();
      setLanguagePreference(nextLang);
      if (pageData.pageType === 'ask-ai') {
        window.location.href = buildAskAiLanguageSwitchUrl(nextLang);
        return;
      }
      if (pageData.langSwitchUrl) {
        window.location.href = pageData.langSwitchUrl;
      }
    });
  });
};

const initThemeSwitchers = () => {
  themeSwitchers.forEach((switcher) => {
    const trigger = switcher.querySelector('[data-theme-trigger]');
    if (!trigger) {
      return;
    }
    trigger.addEventListener('click', () => {
      toggleThemeMode();
    });
  });
};

export const initThemeControls = () => {
  updateLangSwitchers(state.language);
  setLangSwitcherVisibility();
  initSystemThemeSync();
  initTheme();
  initLangSwitchers();
  initThemeSwitchers();
};
