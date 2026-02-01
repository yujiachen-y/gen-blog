import {
  pageData,
  state,
  themeSwitchers,
  langSwitchers,
  themeStorageKey,
  languageStorageKey,
  themeModes,
  saveScrollPosition,
} from './state.js';

const normalizeThemeMode = (mode) => (themeModes.includes(mode) ? mode : 'auto');

const getNextThemeMode = (mode) => {
  const index = themeModes.indexOf(mode);
  const nextIndex = index === -1 ? 0 : (index + 1) % themeModes.length;
  return themeModes[nextIndex];
};

const updateThemeToggles = (mode) => {
  const labelText = mode.charAt(0).toUpperCase() + mode.slice(1);
  const nextMode = getNextThemeMode(mode);
  themeSwitchers.forEach((switcher) => {
    switcher.dataset.themeState = mode;
    const label = switcher.querySelector('[data-theme-label]');
    if (label) {
      label.textContent = labelText;
    }
    const trigger = switcher.querySelector('[data-theme-trigger]');
    if (trigger) {
      trigger.setAttribute(
        'aria-label',
        `Theme mode: ${labelText}. Click to switch to ${nextMode}.`
      );
    }
    const options = switcher.querySelectorAll('[data-theme-option]');
    options.forEach((option) => {
      const isSelected = option.dataset.themeOption === mode;
      option.classList.toggle('is-selected', isSelected);
      option.setAttribute('aria-selected', isSelected);
    });
  });
};

const applyThemeMode = (mode, { persist = false } = {}) => {
  const normalizedMode = normalizeThemeMode(mode);
  document.documentElement.setAttribute('data-theme', normalizedMode);
  updateThemeToggles(normalizedMode);
  if (persist) {
    localStorage.setItem(themeStorageKey, normalizedMode);
  }
};

const initTheme = () => {
  const storedMode = normalizeThemeMode(localStorage.getItem(themeStorageKey));
  applyThemeMode(storedMode);
};

const normalizeLanguage = (value) => {
  const raw = value ? String(value).toLowerCase().trim() : '';
  if (raw.startsWith('zh')) {
    return 'zh';
  }
  if (raw.startsWith('en')) {
    return 'en';
  }
  return null;
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

const setThemeMenuState = (switcher, isOpen) => {
  switcher.classList.toggle('is-open', isOpen);
  const trigger = switcher.querySelector('[data-theme-trigger]');
  if (trigger) {
    trigger.setAttribute('aria-expanded', isOpen);
  }
};

const closeThemeMenus = () => {
  let closed = false;
  themeSwitchers.forEach((switcher) => {
    if (switcher.classList.contains('is-open')) {
      setThemeMenuState(switcher, false);
      closed = true;
    }
  });
  return closed;
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
      if (pageData.langSwitchUrl) {
        window.location.href = pageData.langSwitchUrl;
      }
    });
  });
};

const initThemeSwitchers = () => {
  themeSwitchers.forEach((switcher) => {
    const trigger = switcher.querySelector('[data-theme-trigger]');
    const options = Array.from(switcher.querySelectorAll('[data-theme-option]'));

    if (trigger) {
      trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = switcher.classList.contains('is-open');
        closeThemeMenus();
        setThemeMenuState(switcher, !isOpen);
      });
    }

    options.forEach((option) => {
      option.addEventListener('click', (event) => {
        event.stopPropagation();
        applyThemeMode(option.dataset.themeOption, { persist: true });
        closeThemeMenus();
      });
    });
  });

  document.addEventListener('click', (event) => {
    const clickedSwitcher = themeSwitchers.some((switcher) => switcher.contains(event.target));
    if (!clickedSwitcher) {
      closeThemeMenus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeThemeMenus();
    }
  });
};

export const initThemeControls = () => {
  updateLangSwitchers(state.language);
  setLangSwitcherVisibility();
  initTheme();
  initLangSwitchers();
  initThemeSwitchers();
};
