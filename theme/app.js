const pageDataEl = document.getElementById('page-data');
const pageData = pageDataEl ? JSON.parse(pageDataEl.textContent || '{}') : {};

const grid = document.getElementById('grid-container');
const filterPills = document.getElementById('filter-pills');
const pagination = document.querySelector('[data-pagination]');
const themeSwitchers = Array.from(document.querySelectorAll('[data-theme-switcher]'));
const langSwitchers = Array.from(document.querySelectorAll('[data-lang-switcher]'));

const themeStorageKey = 'gen-blog-theme';
const languageStorageKey = 'gen-blog-lang';
const filterStorageKey = 'gen-blog-filter';
const scrollStorageKey = 'gen-blog-scroll';
const themeModes = ['auto', 'dark', 'light'];

const state = {
  filter: 'all',
  filterIndex: [],
  categories: [],
  initialPosts: pageData.posts || [],
  language: pageData.lang || 'en',
};

const getScrollKey = () => `${scrollStorageKey}:${state.language}:page:${pageData.page ?? 1}`;

const saveScrollPosition = () => {
  if (pageData.pageType !== 'list') {
    return;
  }
  localStorage.setItem(getScrollKey(), String(window.scrollY || 0));
};

const restoreScrollPosition = () => {
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

const getStoredFilter = (lang) => {
  if (!lang) {
    return null;
  }
  return localStorage.getItem(`${filterStorageKey}:${lang}`);
};

const setStoredFilter = (lang, slug) => {
  if (!lang) {
    return;
  }
  localStorage.setItem(`${filterStorageKey}:${lang}`, slug);
};

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

const slugifySegment = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const buildCategories = (posts) => {
  const map = new Map();
  posts.forEach((post) => {
    (post.categories || []).forEach((category) => {
      const slug = slugifySegment(category);
      if (!map.has(slug)) {
        map.set(slug, { slug, name: category });
      }
    });
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const createFilterButton = (label, slug) => {
  const button = document.createElement('button');
  button.className = 'filter-pill';
  button.dataset.category = slug;
  button.textContent = label;
  button.addEventListener('click', () => {
    state.filter = slug;
    setStoredFilter(state.language, slug);
    updateActiveFilter();
    renderFilteredPosts();
  });
  return button;
};

const updateActiveFilter = () => {
  if (!filterPills) {
    return;
  }
  const buttons = filterPills.querySelectorAll('.filter-pill');
  buttons.forEach((button) => {
    const isActive = button.dataset.category === state.filter;
    button.classList.toggle('active', isActive);
  });
};

const renderFilters = () => {
  if (!filterPills) {
    return;
  }
  filterPills.innerHTML = '';
  filterPills.appendChild(createFilterButton('All', 'all'));
  state.categories.forEach((category) => {
    filterPills.appendChild(createFilterButton(category.name, category.slug));
  });
  updateActiveFilter();
};

const createPicture = (coverImage, altText) => {
  if (!coverImage) {
    return null;
  }
  const picture = document.createElement('picture');
  const source = document.createElement('source');
  source.srcset = coverImage.webp;
  source.type = 'image/webp';
  const img = document.createElement('img');
  img.src = coverImage.fallback;
  img.alt = altText;
  img.loading = 'lazy';
  img.className = 'card-image';
  picture.append(source, img);
  return picture;
};

const createCard = (post) => {
  const card = document.createElement('a');
  const hasImage = Boolean(post.coverImage);
  card.className = hasImage ? 'card has-image' : 'card';
  card.href = post.url;

  const wrapper = document.createElement('div');
  wrapper.className = 'card-content-wrapper';

  const meta = document.createElement('div');
  meta.className = 'card-date';
  const primaryCategory = (post.categories && post.categories[0]) || 'General';
  meta.textContent = `${post.date} · ${primaryCategory.toUpperCase()}`;

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = post.title;

  const excerpt = document.createElement('div');
  excerpt.className = 'card-excerpt';
  excerpt.textContent = post.excerpt;

  wrapper.append(meta, title, excerpt);
  card.appendChild(wrapper);

  if (hasImage) {
    const picture = createPicture(post.coverImage, post.title);
    if (picture) {
      card.appendChild(picture);
    }
  }

  return card;
};

const renderPosts = (posts) => {
  if (!grid) {
    return;
  }
  grid.innerHTML = '';
  posts.forEach((post) => {
    grid.appendChild(createCard(post));
  });
};

const swapPosts = (nextPosts) => {
  renderPosts(nextPosts);
};

const setPaginationVisible = (isVisible) => {
  if (!pagination) {
    return;
  }
  pagination.classList.toggle('is-hidden', !isVisible);
};

const renderFilteredPosts = () => {
  if (state.filter === 'all') {
    swapPosts(state.initialPosts);
    setPaginationVisible(true);
    return;
  }
  const filtered = state.filterIndex.filter((post) =>
    (post.categories || []).some((category) => slugifySegment(category) === state.filter)
  );
  swapPosts(filtered);
  setPaginationVisible(false);
};

const loadFilterIndex = async () => {
  if (!pageData.filterIndexUrl) {
    return [];
  }
  const response = await fetch(pageData.filterIndexUrl);
  if (!response.ok) {
    throw new Error('Failed to load filter index');
  }
  return response.json();
};

const initFilters = async () => {
  if (pageData.pageType !== 'list') {
    return;
  }
  if (!filterPills || !grid) {
    return;
  }
  try {
    const index = await loadFilterIndex();
    state.filterIndex = index.filter((post) => post.lang === state.language);
    state.categories = buildCategories(state.filterIndex);
    const storedFilter = getStoredFilter(state.language);
    if (
      storedFilter &&
      (storedFilter === 'all' ||
        state.categories.some((category) => category.slug === storedFilter))
    ) {
      state.filter = storedFilter;
    } else if (storedFilter) {
      setStoredFilter(state.language, 'all');
      state.filter = 'all';
    }
    renderFilters();
    if (state.filter !== 'all') {
      renderFilteredPosts();
    }
  } catch (error) {
    console.error(error);
  }
};

const markTallImages = () => {
  if (pageData.pageType !== 'post') {
    return;
  }
  const images = Array.from(document.querySelectorAll('.article-body img'));
  if (!images.length) {
    return;
  }
  const tallRatio = 1.35;
  const apply = (img) => {
    const { naturalWidth, naturalHeight } = img;
    if (!naturalWidth || !naturalHeight) {
      return;
    }
    const ratio = naturalHeight / naturalWidth;
    img.classList.toggle('is-tall', ratio >= tallRatio);
  };
  images.forEach((img) => {
    if (img.complete) {
      apply(img);
    } else {
      img.addEventListener('load', () => apply(img), { once: true });
    }
  });
};

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

const init = async () => {
  updateLangSwitchers(state.language);
  setLangSwitcherVisibility();
  initTheme();
  await initFilters();
  restoreScrollPosition();
  markTallImages();
  window.addEventListener('beforeunload', saveScrollPosition);
};

init();
