import {
  pageData,
  uiLabels,
  grid,
  filterPills,
  searchInput,
  state,
  getStoredFilter,
  setStoredFilter,
} from './state.js';

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

const createCard = (post) => {
  const card = document.createElement('a');
  const hasImage = Boolean(post.coverImage);
  card.className = hasImage ? 'card has-image' : 'card';
  card.href = post.url;

  const wrapper = document.createElement('div');
  wrapper.className = 'card-content-wrapper';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = post.title;
  title.dataset.cat = String(
    Number.isInteger(post.categoryColorIndex) ? post.categoryColorIndex : 0
  );

  const date = document.createElement('span');
  date.className = 'card-date';
  date.textContent = post.shortDate || post.date || '';

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
    const year = post.year || (post.date ? post.date.slice(0, 4) : 'Unknown');
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

export const initFilters = async () => {
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
    await initSearch();
  } catch (error) {
    console.error(error);
  }
};
