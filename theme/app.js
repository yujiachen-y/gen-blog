const pageDataEl = document.getElementById('page-data');
const pageData = pageDataEl ? JSON.parse(pageDataEl.textContent || '{}') : {};
const uiLabels = pageData.labels || {};

const grid = document.getElementById('grid-container');
const filterPills = document.getElementById('filter-pills');
const themeSwitchers = Array.from(document.querySelectorAll('[data-theme-switcher]'));
const langSwitchers = Array.from(document.querySelectorAll('[data-lang-switcher]'));

const themeStorageKey = 'gen-blog-theme';
const languageStorageKey = 'gen-blog-lang';
const filterStorageKey = 'gen-blog-filter';
const scrollStorageKey = 'gen-blog-scroll';
const themeModes = ['auto', 'dark', 'light'];

const searchInput = document.getElementById('search-input');

const state = {
  filter: 'all',
  filterIndex: [],
  categories: [],
  initialPosts: pageData.posts || [],
  language: pageData.lang || 'en',
  searchQuery: '',
  fuseInstance: null,
};

const getScrollKey = () => `${scrollStorageKey}:${state.language}`;

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
  filterPills.appendChild(createFilterButton(uiLabels.filterAll || 'All', 'all'));
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

const getCategoryColorIndex = (categoryName) => {
  const sorted = state.categories.map((c) => c.name).sort((a, b) => a.localeCompare(b));
  const idx = sorted.indexOf(categoryName);
  return idx === -1 ? 0 : idx % 5;
};

const formatShortDate = (dateStr) => {
  if (!dateStr || dateStr.length < 10) {
    return dateStr || '';
  }
  return dateStr.slice(5);
};

const createCard = (post) => {
  const card = document.createElement('a');
  const hasImage = Boolean(post.coverImage);
  card.className = hasImage ? 'card has-image' : 'card';
  card.href = post.url;

  const wrapper = document.createElement('div');
  wrapper.className = 'card-content-wrapper';

  const primaryCategory = (post.categories && post.categories[0]) || 'General';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = post.title;
  title.dataset.cat = String(getCategoryColorIndex(primaryCategory));

  const date = document.createElement('span');
  date.className = 'card-date';
  date.textContent = formatShortDate(post.date);

  wrapper.append(title, date);
  card.appendChild(wrapper);

  if (hasImage) {
    const picture = createPicture(post.coverImage, post.title);
    if (picture) {
      card.appendChild(picture);
    }
  }

  return card;
};

const groupPostsByYear = (posts) => {
  const groups = [];
  posts.forEach((post) => {
    const year = post.date ? post.date.slice(0, 4) : 'Unknown';
    const current = groups[groups.length - 1];
    if (!current || current.year !== year) {
      groups.push({ year, posts: [post] });
    } else {
      current.posts.push(post);
    }
  });
  return groups;
};

const renderPosts = (posts) => {
  if (!grid) {
    return;
  }
  grid.innerHTML = '';
  groupPostsByYear(posts).forEach((group) => {
    const section = document.createElement('section');
    section.className = 'year-section';

    const heading = document.createElement('h2');
    heading.className = 'year-heading';
    heading.textContent = group.year;

    const list = document.createElement('div');
    list.className = 'year-posts';
    group.posts.forEach((post) => {
      list.appendChild(createCard(post));
    });

    section.append(heading, list);
    grid.appendChild(section);
  });
};

const swapPosts = (nextPosts) => {
  renderPosts(nextPosts);
};

const getFilteredPosts = () => {
  let posts =
    state.filter === 'all'
      ? state.initialPosts
      : state.filterIndex.filter((post) =>
          (post.categories || []).some((category) => slugifySegment(category) === state.filter)
        );

  if (state.searchQuery && state.fuseInstance) {
    const searchResults = state.fuseInstance.search(state.searchQuery);
    const matchKeys = new Set(searchResults.map((r) => r.item.translationKey));
    posts = posts.filter((post) => matchKeys.has(post.translationKey));
  }

  return posts;
};

const renderFilteredPosts = () => {
  const posts = getFilteredPosts();
  if (posts.length === 0 && (state.filter !== 'all' || state.searchQuery)) {
    if (grid) {
      grid.innerHTML = '<div class="search-empty">No posts found.</div>';
    }
    return;
  }
  swapPosts(posts);
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

const colorizeExistingCards = () => {
  const titleEls = document.querySelectorAll('.card-title');
  titleEls.forEach((el) => {
    if (el.dataset.cat !== undefined) {
      return;
    }
    const card = el.closest('.card');
    if (!card) {
      return;
    }
    const catEl = card.querySelector('[data-category-name]');
    if (!catEl) {
      return;
    }
    const categoryName = catEl.dataset.categoryName;
    const original = state.categories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase()
    );
    if (original) {
      el.dataset.cat = String(getCategoryColorIndex(original.name));
    }
  });
};

const initSearch = async () => {
  if (!searchInput) {
    return;
  }
  try {
    const module = await import('/fuse.mjs');
    const Fuse = module.default || module;
    state.fuseInstance = new Fuse(state.filterIndex, {
      keys: ['title'],
      threshold: 0.35,
      ignoreLocation: true,
    });

    let debounceTimer = null;
    searchInput.addEventListener('input', () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        state.searchQuery = searchInput.value.trim();
        renderFilteredPosts();
      }, 200);
    });
  } catch (error) {
    console.error('Failed to load Fuse.js:', error);
  }
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
    colorizeExistingCards();
    if (state.filter !== 'all') {
      renderFilteredPosts();
    }
    await initSearch();
  } catch (error) {
    console.error(error);
  }
};

const initToc = () => {
  if (pageData.pageType !== 'post' && pageData.pageType !== 'about') {
    return;
  }
  const toc = document.querySelector('[data-toc]');
  if (!toc) {
    return;
  }
  const toggle = toc.querySelector('[data-toc-toggle]');
  const panel = toc.querySelector('[data-toc-panel]');
  if (!toggle || !panel) {
    return;
  }
  const setOpen = (isOpen) => {
    toc.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  };
  const isMobile = window.matchMedia('(max-width: 900px)').matches;
  setOpen(!isMobile);
  toggle.addEventListener('click', () => {
    setOpen(!toc.classList.contains('is-open'));
  });
  panel.addEventListener('click', (event) => {
    if (!window.matchMedia('(max-width: 900px)').matches) {
      return;
    }
    if (event.target instanceof HTMLAnchorElement) {
      setOpen(false);
    }
  });
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

const updateActiveNav = () => {
  const navLinks = document.querySelectorAll('.nav-link-button');
  navLinks.forEach((link) => {
    let isActive = false;
    const navType = link.dataset.nav;
    if (pageData.pageType === 'about' && navType === 'about') {
      isActive = true;
    } else if (
      (pageData.pageType === 'list' || pageData.pageType === 'post') &&
      navType === 'blog'
    ) {
      isActive = true;
    }

    // Fallback: Check strictly by URL if pageType logic didn't match (e.g. unknown pages)
    if (!isActive) {
      try {
        const linkPath = new URL(link.href, window.location.origin).pathname;
        if (window.location.pathname === linkPath) {
          isActive = true;
        }
      } catch (e) {
        // ignore
      }
    }

    link.classList.toggle('active', isActive);
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

/* ---------- Comments ---------- */

const CUSDIS_API = 'https://cusdis.com';
const COMMENT_MAX_LENGTH = 2000;

const commentLabels = {
  en: {
    title: 'COMMENTS',
    nickname: 'Nickname',
    email: 'Email (optional)',
    placeholder: 'Leave a comment...',
    submit: 'Submit',
    reply: 'Reply',
    cancel: 'Cancel',
    pending: 'Your comment is pending approval.',
    empty: 'No comments yet.',
    loadMore: 'Load more',
    maxLengthHint: 'Up to {max} characters.',
  },
  zh: {
    title: '评论',
    nickname: '昵称',
    email: '邮箱（选填）',
    placeholder: '写下你的评论...',
    submit: '提交',
    reply: '回复',
    cancel: '取消',
    pending: '你的评论正在等待审核。',
    empty: '暂无评论。',
    loadMore: '加载更多',
    maxLengthHint: '最多 {max} 字。',
  },
};

const formatMaxLengthHint = (label, max) => label.replace('{max}', String(max));

const buildPendingNotice = (text, inline = false) => {
  const pending = document.createElement('div');
  pending.className = inline ? 'comment-pending comment-pending-inline' : 'comment-pending';
  pending.textContent = text;
  pending.hidden = false;
  return pending;
};

const showPendingNotice = (pending) => {
  if (!pending) return;
  pending.hidden = false;
  requestAnimationFrame(() => {
    pending.classList.add('is-visible');
  });
};

const showInlinePending = (form, text) => {
  const parent = form.parentNode;
  if (!parent) return;
  const existing = parent.querySelector('.comment-pending-inline');
  if (existing) existing.remove();
  const pending = buildPendingNotice(text, true);
  parent.insertBefore(pending, form.nextSibling);
  showPendingNotice(pending);
};

const fetchComments = async (config, page = 1) => {
  const params = new URLSearchParams({
    appId: config.appId,
    pageId: config.pageId,
    page: String(page),
  });
  const res = await fetch(`${CUSDIS_API}/api/open/comments?${params}`);
  if (!res.ok) throw new Error('fetch comments failed');
  const json = await res.json();
  return json.data;
};

const postComment = async (config, body) => {
  const res = await fetch(`${CUSDIS_API}/api/open/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('post comment failed');
  return res.json();
};

const formatCommentDate = (raw, locale) => {
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw || '';
    return d.toLocaleDateString(locale || undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return raw || '';
  }
};

const buildCommentEl = (comment, labels, config, locale, depth = 0) => {
  const article = document.createElement('article');
  article.className = depth > 0 ? 'comment comment-child' : 'comment';

  const header = document.createElement('div');
  header.className = 'comment-header';
  const name = document.createElement('span');
  name.className = 'comment-author';
  name.textContent = comment.by_nickname || 'Anonymous';
  const date = document.createElement('span');
  date.className = 'comment-date';
  date.textContent = formatCommentDate(comment.createdAt, locale);
  header.append(name, date);

  const body = document.createElement('div');
  body.className = 'comment-body';
  body.textContent = comment.content;

  article.append(header, body);

  if (depth === 0) {
    const replyBtn = document.createElement('button');
    replyBtn.className = 'comment-reply-btn';
    replyBtn.type = 'button';
    replyBtn.textContent = labels.reply;
    replyBtn.addEventListener('click', () => {
      if (article.querySelector('.comment-reply-form')) return;
      const form = buildCommentForm(labels, config, comment.id, () => {
        form.remove();
      });
      form.classList.add('comment-reply-form');
      article.appendChild(form);
    });
    article.appendChild(replyBtn);
  }

  if (comment.replies && comment.replies.data && comment.replies.data.length) {
    const repliesWrap = document.createElement('div');
    repliesWrap.className = 'comment-replies';
    comment.replies.data.forEach((reply) => {
      repliesWrap.appendChild(buildCommentEl(reply, labels, config, locale, depth + 1));
    });
    article.appendChild(repliesWrap);
  }

  return article;
};

const buildCommentForm = (labels, config, parentId, onCancel) => {
  const form = document.createElement('form');
  form.className = 'comment-form';

  const row = document.createElement('div');
  row.className = 'comment-form-row';

  const nicknameInput = document.createElement('input');
  nicknameInput.type = 'text';
  nicknameInput.className = 'comment-input';
  nicknameInput.placeholder = labels.nickname;
  nicknameInput.required = true;

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.className = 'comment-input';
  emailInput.placeholder = labels.email;

  row.append(nicknameInput, emailInput);

  const textarea = document.createElement('textarea');
  textarea.className = 'comment-textarea';
  textarea.placeholder = labels.placeholder;
  textarea.required = true;
  textarea.rows = 3;
  textarea.maxLength = COMMENT_MAX_LENGTH;

  const hint = document.createElement('div');
  hint.className = 'comment-hint';
  hint.textContent = formatMaxLengthHint(labels.maxLengthHint, COMMENT_MAX_LENGTH);

  const actions = document.createElement('div');
  actions.className = 'comment-form-actions';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'comment-submit';
  submitBtn.textContent = labels.submit;

  actions.appendChild(submitBtn);

  if (onCancel) {
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'comment-cancel';
    cancelBtn.textContent = labels.cancel;
    cancelBtn.addEventListener('click', onCancel);
    actions.insertBefore(cancelBtn, submitBtn);
  }

  form.append(row, textarea, hint, actions);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    try {
      await postComment(config, {
        appId: config.appId,
        pageId: config.pageId,
        content: textarea.value.trim(),
        nickname: nicknameInput.value.trim(),
        email: emailInput.value.trim() || undefined,
        parentId: parentId || undefined,
      });
      form.reset();
      if (onCancel) {
        showInlinePending(form, labels.pending);
        onCancel();
      } else {
        const section = document.querySelector('[data-comment-section]');
        const pending = section && section.querySelector('.comment-pending');
        if (pending) showPendingNotice(pending);
      }
    } catch {
      // degrade silently
    } finally {
      submitBtn.disabled = false;
    }
  });

  return form;
};

const initComments = async () => {
  const config = pageData.comments;
  if (!config) return;

  const section = document.querySelector('[data-comment-section]');
  if (!section) return;

  const lang = pageData.lang || 'en';
  const labels = commentLabels[lang] || commentLabels.en;
  const locale = lang || undefined;

  const label = document.createElement('div');
  label.className = 'comment-label';
  label.textContent = labels.title;
  section.appendChild(label);

  const list = document.createElement('div');
  list.className = 'comment-list';
  section.appendChild(list);

  const empty = document.createElement('div');
  empty.className = 'comment-empty';
  empty.textContent = labels.empty;
  empty.hidden = true;
  section.appendChild(empty);

  const loadMore = document.createElement('button');
  loadMore.type = 'button';
  loadMore.className = 'comment-load-more';
  loadMore.textContent = labels.loadMore;
  loadMore.hidden = true;
  section.appendChild(loadMore);

  const mainForm = buildCommentForm(labels, config, null, null);
  section.appendChild(mainForm);

  const pending = document.createElement('div');
  pending.className = 'comment-pending';
  pending.textContent = labels.pending;
  pending.hidden = true;
  section.appendChild(pending);

  let currentPage = 1;
  let pageCount = 1;

  const renderPage = (data) => {
    (data.data || []).forEach((comment) => {
      list.appendChild(buildCommentEl(comment, labels, config, locale));
    });
    pageCount = data.pageCount || 1;
    empty.hidden = list.children.length > 0;
    loadMore.hidden = currentPage >= pageCount;
  };

  try {
    const data = await fetchComments(config, 1);
    renderPage(data);
  } catch {
    // degrade silently
  }

  loadMore.addEventListener('click', async () => {
    loadMore.disabled = true;
    try {
      currentPage += 1;
      const data = await fetchComments(config, currentPage);
      renderPage(data);
    } catch {
      // degrade silently
    } finally {
      loadMore.disabled = false;
    }
  });
};

const init = async () => {
  updateLangSwitchers(state.language);
  setLangSwitcherVisibility();
  initTheme();
  await initFilters();
  restoreScrollPosition();
  initToc();
  markTallImages();
  updateActiveNav();
  initComments();
  window.addEventListener('beforeunload', saveScrollPosition);
};

init();
