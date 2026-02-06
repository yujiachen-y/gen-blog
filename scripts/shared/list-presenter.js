const UNKNOWN_YEAR = 'Unknown';

export const formatShortDate = (dateStr) => {
  if (!dateStr || dateStr.length < 10) {
    return dateStr || '';
  }
  return dateStr.slice(5);
};

export const getPostYear = (dateStr) => {
  if (!dateStr || dateStr.length < 4) {
    return UNKNOWN_YEAR;
  }
  return dateStr.slice(0, 4);
};

const getPrimaryCategory = (post) =>
  Array.isArray(post.categories) && post.categories.length > 0 ? post.categories[0] : 'General';

export const collectSortedCategoryNames = (posts) => {
  const categorySet = new Set();
  posts.forEach((post) => {
    (post.categories || []).forEach((category) => categorySet.add(category));
  });
  return Array.from(categorySet).sort((a, b) => a.localeCompare(b));
};

export const buildCategoryColorMap = (posts) => {
  const categoryNames = collectSortedCategoryNames(posts);
  return categoryNames.reduce((acc, name, index) => {
    acc.set(name, index % 5);
    return acc;
  }, new Map());
};

export const getCategoryColorIndex = (post, colorMap) => {
  const primaryCategory = getPrimaryCategory(post);
  if (!colorMap.has(primaryCategory)) {
    return 0;
  }
  return colorMap.get(primaryCategory);
};

export const decorateListItems = (posts) => {
  const colorMap = buildCategoryColorMap(posts);
  return posts.map((post) => ({
    ...post,
    year: getPostYear(post.date),
    shortDate: formatShortDate(post.date),
    categoryColorIndex: getCategoryColorIndex(post, colorMap),
  }));
};

export const groupPostsByYear = (posts) => {
  const groups = [];
  posts.forEach((post) => {
    const year = post.year || getPostYear(post.date);
    const current = groups[groups.length - 1];
    if (!current || current.year !== year) {
      groups.push({ year, items: [post] });
    } else {
      current.items.push(post);
    }
  });
  return groups;
};

export const buildPostSummary = (post) => ({
  translationKey: post.translationKey,
  lang: post.lang,
  title: post.title,
  date: post.date,
  shortDate: post.shortDate,
  year: post.year,
  categories: post.categories,
  categoryColorIndex: post.categoryColorIndex,
  coverImage: post.coverPicture
    ? {
        webp: post.coverPicture.sources[0].src,
        fallback: post.coverPicture.img.src,
      }
    : null,
  url: post.url,
});
