const grid = document.getElementById('grid-container');
const filterPills = document.getElementById('filter-pills');
const navBrand = document.getElementById('nav-brand');
const aboutTriggers = Array.from(document.querySelectorAll('[data-about-trigger]'));
const aboutView = document.getElementById('about-view');
const closeAboutBtn = document.getElementById('close-about-btn');
const articleView = document.getElementById('article-view');
const closeArticleBtn = document.getElementById('close-article-btn');
const articleContent = document.getElementById('article-content');
const themeSwitchers = Array.from(document.querySelectorAll('[data-theme-switcher]'));
const langSwitchers = Array.from(document.querySelectorAll('[data-lang-switcher]'));

const state = {
  posts: [],
  postIndex: [],
  categories: [],
  filter: 'all',
  activePostKey: null,
  activePostLang: null,
  view: 'home',
  postCache: new Map(),
  language: 'en',
};

const themeStorageKey = 'gen-blog-theme';
const themeModes = ['auto', 'dark', 'light'];
const themeState = {
  mode: 'auto',
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
  themeState.mode = normalizedMode;
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

const languageStorageKey = 'gen-blog-lang';
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

const getPreferredLanguage = () => {
  const stored = normalizeLanguage(localStorage.getItem(languageStorageKey));
  if (stored) {
    return stored;
  }
  const browserLang = (navigator.language || '').toLowerCase();
  if (browserLang.startsWith('zh')) {
    return 'zh';
  }
  return 'en';
};

const slugifySegment = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const loadIndex = async () => {
  const response = await fetch('./posts/index.json');
  if (!response.ok) {
    throw new Error('Failed to load post index');
  }
  return response.json();
};

const loadPost = async (translationKey, lang) => {
  const cacheKey = `${translationKey}:${lang}`;
  if (state.postCache.has(cacheKey)) {
    return state.postCache.get(cacheKey);
  }
  const response = await fetch(`./posts/${translationKey}/${lang}.json`);
  if (!response.ok) {
    throw new Error('Failed to load post');
  }
  const data = await response.json();
  state.postCache.set(cacheKey, data);
  return data;
};

const buildCategories = (posts) => {
  const map = new Map();
  posts.forEach((post) => {
    const category = post.category || 'General';
    const slug = post.categorySlug || slugifySegment(category);
    if (!map.has(slug)) {
      map.set(slug, { slug, name: category });
    }
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
    updateActiveFilter();
    render();
  });
  return button;
};

const updateActiveFilter = () => {
  const buttons = filterPills.querySelectorAll('.filter-pill');
  buttons.forEach((button) => {
    const isActive = button.dataset.category === state.filter;
    button.classList.toggle('active', isActive);
  });
};

const renderFilters = () => {
  filterPills.innerHTML = '';
  filterPills.appendChild(createFilterButton('All', 'all'));
  state.categories.forEach((category) => {
    filterPills.appendChild(createFilterButton(category.name, category.slug));
  });
  updateActiveFilter();
};

const createCard = (post) => {
  const card = document.createElement('div');
  const hasImage = Boolean(post.coverImage);
  card.className = hasImage ? 'card has-image' : 'card';
  card.dataset.id = post.translationKey;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  const wrapper = document.createElement('div');
  wrapper.className = 'card-content-wrapper';

  const meta = document.createElement('div');
  meta.className = 'card-date';
  meta.textContent = `${post.date} · ${post.category.toUpperCase()}`;

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = post.title;

  const excerpt = document.createElement('div');
  excerpt.className = 'card-excerpt';
  excerpt.textContent = post.excerpt;

  wrapper.appendChild(meta);
  wrapper.appendChild(title);
  wrapper.appendChild(excerpt);

  card.appendChild(wrapper);

  if (hasImage) {
    const img = document.createElement('img');
    img.className = 'card-image';
    img.src = post.coverImage;
    img.alt = post.title;
    card.appendChild(img);
  }

  const handleOpen = () => {
    navigateToPost(post.translationKey, post.lang, card);
  };

  card.addEventListener('click', handleOpen);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpen();
    }
  });

  return card;
};

const render = () => {
  grid.innerHTML = '';
  const filteredPosts =
    state.filter === 'all'
      ? state.posts
      : state.posts.filter((post) => post.categorySlug === state.filter);

  filteredPosts.forEach((post) => {
    grid.appendChild(createCard(post));
  });
};

const buildArticleHtml = (post) => {
  const coverHtml = post.coverImage
    ? `<div class="article-cover">
         <img src="${post.coverImage}" alt="${post.title}" />
         <div class="article-cover-overlay"></div>
       </div>`
    : '';
  return `
    ${coverHtml}
    <div class="article-text-content">
      <div class="article-date">${post.date} · ${post.category.toUpperCase()}</div>
      <h1 class="article-hero">${post.title}</h1>
      <div class="article-body">${post.content}</div>
    </div>
  `;
};

const openArticle = (post, sourceCardElement, { pushHistory = true, animate = true } = {}) => {
  state.activePostKey = post.translationKey;
  state.activePostLang = post.lang;
  document.body.classList.add('view-article');

  const card =
    sourceCardElement || document.querySelector(`.card[data-id="${post.translationKey}"]`);

  articleContent.innerHTML = buildArticleHtml(post);

  if (animate && card) {
    const rect = card.getBoundingClientRect();
    articleView.style.transition = 'none';
    articleView.style.top = `${rect.top}px`;
    articleView.style.left = `${rect.left}px`;
    articleView.style.width = `${rect.width}px`;
    articleView.style.height = `${rect.height}px`;
    articleView.style.borderRadius = '12px';
    articleView.style.opacity = '1';
    articleView.style.transform = 'none';
    articleView.style.display = 'block';

    articleView.offsetHeight;

    articleView.style.transition = 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
    requestAnimationFrame(() => {
      articleView.classList.add('active');
      articleView.style.top = '0';
      articleView.style.left = '0';
      articleView.style.width = '100%';
      articleView.style.height = '100%';
      articleView.style.borderRadius = '0px';
    });
  } else if (animate) {
    articleView.style.display = 'block';
    requestAnimationFrame(() => articleView.classList.add('active'));
  } else {
    articleView.style.display = 'block';
    articleView.style.transition = 'none';
    articleView.style.top = '0';
    articleView.style.left = '0';
    articleView.style.width = '100%';
    articleView.style.height = '100%';
    articleView.style.borderRadius = '0px';
    articleView.style.opacity = '1';
    articleView.style.transform = 'none';
    articleView.classList.add('active');
  }

  document.body.style.overflow = 'hidden';
  state.view = 'article';

  if (pushHistory) {
    navigate(buildPostHash(post.translationKey, post.lang));
  }
};

const closeArticle = (pushHistory = true) => {
  if (!state.activePostKey) {
    return;
  }

  const currentKey = state.activePostKey;
  const card = document.querySelector(`.card[data-id="${currentKey}"]`);

  state.activePostKey = null;
  state.activePostLang = null;

  if (card) {
    const rect = card.getBoundingClientRect();
    articleView.style.overflow = 'hidden';
    articleView.style.transition = 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
    articleView.style.top = `${rect.top}px`;
    articleView.style.left = `${rect.left}px`;
    articleView.style.width = `${rect.width}px`;
    articleView.style.height = `${rect.height}px`;
    articleView.style.borderRadius = '12px';
    articleContent.style.transition = 'opacity 0.2s';
    articleContent.style.opacity = '0';
  } else {
    articleView.classList.remove('active');
    articleView.style.opacity = '0';
  }

  setTimeout(() => {
    resetViewStyles(articleView);
    articleContent.style.opacity = '';
  }, 500);

  if (pushHistory) {
    navigate('#/');
  }
};

const openAbout = (pushHistory = true) => {
  aboutView.classList.add('active');
  state.view = 'about';
  if (pushHistory) {
    navigate('#/about');
  }
};

const closeAbout = (pushHistory = true) => {
  aboutView.classList.remove('active');
  if (pushHistory) {
    navigate('#/');
  }
};

const resetViewStyles = (el) => {
  el.classList.remove('active');
  el.style.display = 'none';
  el.style.opacity = '';
  el.style.top = '';
  el.style.left = '';
  el.style.width = '';
  el.style.height = '';
  el.style.overflow = '';
  el.style.transition = '';
  el.style.borderRadius = '';
  document.body.style.overflow = '';
  document.body.classList.remove('view-article');
};

const navigate = (hash) => {
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  } else {
    handleRoute();
  }
};

const navigateToPost = (translationKey, lang, card) => {
  const existing = state.postIndex.find((post) => post.translationKey === translationKey);
  if (!existing) {
    return;
  }
  openArticleByKey(translationKey, lang, card, { pushHistory: true, animate: true });
};

const resolvePostTranslation = (group, preferredLang) => {
  if (!group || !group.translations) {
    return null;
  }
  const languages = group.languages || Object.keys(group.translations);
  const resolvedLang =
    (preferredLang && languages.includes(preferredLang) && preferredLang) ||
    (group.defaultLang && languages.includes(group.defaultLang) && group.defaultLang) ||
    languages[0];
  const translation = group.translations[resolvedLang];
  if (!translation) {
    return null;
  }
  return {
    ...translation,
    translationKey: group.translationKey,
    lang: resolvedLang,
    availableLangs: languages,
    defaultLang: group.defaultLang,
  };
};

const setLanguage = (lang, { persist = false } = {}) => {
  const normalized = normalizeLanguage(lang);
  if (!normalized) {
    return;
  }
  if (persist) {
    localStorage.setItem(languageStorageKey, normalized);
  }
  if (state.language === normalized) {
    updateLangSwitchers(normalized);
    return;
  }
  state.language = normalized;
  state.posts = state.postIndex
    .map((group) => resolvePostTranslation(group, state.language))
    .filter(Boolean)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  state.categories = buildCategories(state.posts);
  renderFilters();
  render();
  updateLangSwitchers(state.language);
};

const openArticleByKey = async (
  translationKey,
  lang,
  card,
  { pushHistory = true, animate = true, syncLanguage = true } = {}
) => {
  if (state.activePostKey === translationKey && state.activePostLang === lang) {
    return;
  }
  const group = state.postIndex.find((post) => post.translationKey === translationKey);
  if (!group) {
    return;
  }
  const requestedLang = normalizeLanguage(lang) || state.language;
  const summary = resolvePostTranslation(group, requestedLang);
  if (!summary) {
    return;
  }
  if (syncLanguage) {
    setLanguage(summary.lang, { persist: Boolean(lang) });
  }

  try {
    const detail = await loadPost(translationKey, summary.lang);
    const post = {
      ...summary,
      content: detail.content || summary.content || '',
      coverImage: detail.coverImage || summary.coverImage || null,
    };
    openArticle(post, card, { pushHistory, animate });
  } catch (error) {
    console.error(error);
  }
};

const parseHash = () => {
  const raw = window.location.hash || '#/';
  const cleaned = raw.replace(/^#\//, '');
  return cleaned.split('/').filter(Boolean);
};

const buildPostHash = (translationKey, lang) => {
  const encodedKey = translationKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  if (lang) {
    return `#/post/${encodedKey}/${lang}`;
  }
  return `#/post/${encodedKey}`;
};

const parsePostRoute = (segments) => {
  if (segments[0] !== 'post') {
    return null;
  }
  const maybeLang = normalizeLanguage(segments[segments.length - 1]);
  const keySegments = maybeLang ? segments.slice(1, -1) : segments.slice(1);
  if (keySegments.length === 0) {
    return null;
  }
  const decodedKey = keySegments.map((segment) => decodeURIComponent(segment)).join('/');
  return {
    translationKey: decodedKey,
    lang: maybeLang,
  };
};

const handleRoute = () => {
  const segments = parseHash();

  if (segments.length === 0) {
    closeArticle(false);
    closeAbout(false);
    state.view = 'home';
    return;
  }

  if (segments[0] === 'about') {
    if (state.view !== 'about') {
      openAbout(false);
    }
    return;
  }

  const postRoute = parsePostRoute(segments);
  if (postRoute) {
    openArticleByKey(postRoute.translationKey, postRoute.lang, null, { pushHistory: false });
    return;
  }

  closeArticle(false);
  closeAbout(false);
  state.view = 'home';
};

navBrand.addEventListener('click', (event) => {
  event.preventDefault();
  navigate('#/');
});

aboutTriggers.forEach((trigger) => {
  trigger.addEventListener('click', () => {
    navigate('#/about');
  });
});

closeAboutBtn.addEventListener('click', () => {
  navigate('#/');
});

closeArticleBtn.addEventListener('click', () => {
  navigate('#/');
});

langSwitchers.forEach((switcher) => {
  const toggle = switcher.querySelector('[data-lang-toggle]');
  if (!toggle) {
    return;
  }
  toggle.addEventListener('click', () => {
    const targetLang = state.language === 'zh' ? 'en' : 'zh';
    toggle.classList.add('is-flash');
    window.setTimeout(() => toggle.classList.remove('is-flash'), 180);
    setLanguage(targetLang, { persist: true });
    if (state.activePostKey) {
      openArticleByKey(state.activePostKey, targetLang, null, {
        pushHistory: true,
        animate: false,
        syncLanguage: false,
      });
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
    if (closeThemeMenus()) {
      return;
    }
    if (state.view === 'article' || state.view === 'about') {
      navigate('#/');
    }
  }
});

const init = async () => {
  try {
    const index = await loadIndex();
    state.postIndex = index;
    state.language = getPreferredLanguage();
    updateLangSwitchers(state.language);
    state.posts = state.postIndex
      .map((group) => resolvePostTranslation(group, state.language))
      .filter(Boolean)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    state.categories = buildCategories(state.posts);
    renderFilters();
    render();
    handleRoute();
  } catch (error) {
    console.error(error);
  }
};

window.addEventListener('hashchange', handleRoute);
initTheme();
init();
