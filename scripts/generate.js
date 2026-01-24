import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

const [inputArg, outputArg] = process.argv.slice(2);

if (!inputArg) {
  console.error('Usage: npm run generate -- <markdownDir> [outputDir]');
  process.exit(1);
}

const inputDir = path.resolve(inputArg);
const outputDir = path.resolve(outputArg ?? 'dist');
const themeDir = path.resolve('theme');

const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const slugifySegment = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const slugifyPath = (value) =>
  value
    .split(/[\\/]+/)
    .map(slugifySegment)
    .filter(Boolean)
    .join('/');

const humanize = (value) =>
  value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const formatDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
};

const buildExcerpt = (content) => {
  const stripped = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~`-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return stripped.length > 160 ? `${stripped.slice(0, 157)}...` : stripped;
};

const collectMarkdownFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectMarkdownFiles(fullPath);
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        return [fullPath];
      }
      return [];
    })
  );

  return nested.flat();
};

const renderLayout = ({
  title,
  navPrefix,
  bodyHtml,
  filtersHtml = '',
  controlsHtml = '',
}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="view-transition" content="same-origin" />
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Lora:ital,wght@0,400;0,600;1,400&display=swap"
      rel="stylesheet">
    <link rel="stylesheet" href="${navPrefix}styles.css" />
  </head>
  <body>
    <nav class="navbar">
      <a class="brand" href="${navPrefix}">Gen Blog</a>
      <div class="controls">
        ${filtersHtml}
        <div class="nav-divider"></div>
        ${controlsHtml}
      </div>
    </nav>

    ${bodyHtml}
  </body>
</html>`;

const buildFilterPills = (categories, navPrefix, activeSlug) => {
  const pill = ({ label, href, slug }) => `
    <a class="filter-pill${slug === activeSlug ? ' active' : ''}" href="${href}">
      ${escapeHtml(label)}
    </a>
  `;

  const allPill = pill({
    label: 'All',
    slug: 'all',
    href: `${navPrefix}`,
  });

  const categoryPills = categories
    .map((category) =>
      pill({
        label: category.name,
        slug: category.slug,
        href: `${navPrefix}categories/${category.slug}/`,
      })
    )
    .join('');

  return `<div class="filter-pills">${allPill}${categoryPills}</div>`;
};

const renderCard = (post, navPrefix) => {
  const coverHtml = post.cover
    ? `<img class="card-image" src="${navPrefix}${post.cover}" alt="${escapeHtml(post.title)}" />`
    : '';
  const cardClass = post.cover ? 'card has-image' : 'card';

  return `
    <a class="${cardClass}" href="${navPrefix}posts/${post.slug}/" style="view-transition-name: post-${post.transitionName}">
      <div class="card-content-wrapper">
        <div class="card-date">${escapeHtml(post.date)} · ${escapeHtml(
          post.category.toUpperCase()
        )}</div>
        <div class="card-title">${escapeHtml(post.title)}</div>
        <div class="card-excerpt">${escapeHtml(post.excerpt)}</div>
      </div>
      ${coverHtml}
    </a>
  `;
};

const renderIndex = (posts, categories) => {
  const cards = posts.map((post) => renderCard(post, './')).join('');

  return renderLayout({
    title: 'Gen Blog',
    navPrefix: './',
    filtersHtml: buildFilterPills(categories, './', 'all'),
    controlsHtml: `<a class="btn-text" href="./about/">About</a>`,
    bodyHtml: `
      <main class="grid-container">
        ${cards}
      </main>
    `,
  });
};

const renderCategoryPage = (category, posts, categories) => {
  const cards = posts.map((post) => renderCard(post, '../../')).join('');

  return renderLayout({
    title: `${category.name} · Gen Blog`,
    navPrefix: '../../',
    filtersHtml: buildFilterPills(categories, '../../', category.slug),
    controlsHtml: `<a class="btn-text" href="../../about/">About</a>`,
    bodyHtml: `
      <main class="grid-container">
        ${cards}
      </main>
    `,
  });
};

const renderAbout = (categories) =>
  renderLayout({
    title: 'About · Gen Blog',
    navPrefix: '../',
    filtersHtml: buildFilterPills(categories, '../', 'all'),
    controlsHtml: `<a class="btn-text" href="../about/">About</a>`,
    bodyHtml: `
      <main class="article-content">
        <div class="article-text-content">
          <h1 class="article-hero">About</h1>
          <div class="article-body">
            <p>This is a generated static blog using the Spatial Hubble style.</p>
            <p>Replace this copy with your own bio or site description.</p>
          </div>
        </div>
      </main>
    `,
  });

const renderPost = (post, categories) => {
  const depth = post.slug.split('/').filter(Boolean).length + 1;
  const navPrefix = '../'.repeat(depth);
  const coverHtml = post.cover
    ? `<div class="article-cover">
         <img src="${navPrefix}${post.cover}" alt="${escapeHtml(post.title)}" />
         <div class="article-cover-overlay"></div>
       </div>`
    : '';

  return renderLayout({
    title: `${post.title} · Gen Blog`,
    navPrefix,
    filtersHtml: buildFilterPills(categories, navPrefix, 'all'),
    controlsHtml: `<a class="btn-text" href="${navPrefix}about/">About</a>`,
    bodyHtml: `
      <main class="article-content" style="view-transition-name: post-${post.transitionName}">
        ${coverHtml}
        <div class="article-text-content">
          <div class="article-meta">${escapeHtml(post.date)} · ${escapeHtml(
            post.category.toUpperCase()
          )}</div>
          <h1 class="article-hero">${escapeHtml(post.title)}</h1>
          <div class="article-body">${post.html}</div>
        </div>
      </main>
    `,
  });
};

const ensureDir = (dir) => fs.mkdir(dir, { recursive: true });

const loadPosts = async () => {
  const files = await collectMarkdownFiles(inputDir);

  if (files.length === 0) {
    return [];
  }

  const posts = await Promise.all(
    files.map(async (filePath) => {
      const raw = await fs.readFile(filePath, 'utf8');
      const { data, content } = matter(raw);
      const relativePath = path.relative(inputDir, filePath);
      const withoutExt = relativePath.replace(/\.md$/i, '');
      const slugSource = data.slug ? String(data.slug) : withoutExt;
      const slug = slugifyPath(slugSource);
      const transitionName = slug.replace(/\//g, '-');
      const stat = await fs.stat(filePath);
      const date = formatDate(data.date) ?? formatDate(stat.mtime) ?? '1970-01-01';
      const contentTitleMatch = content.match(/^#\s+(.+)$/m);
      const title =
        (data.title ? String(data.title) : null) ||
        (contentTitleMatch ? contentTitleMatch[1].trim() : null) ||
        humanize(path.basename(withoutExt));
      const category =
        (data.category ? String(data.category) : null) || slug.split('/')[0] || 'General';
      const excerpt = (data.excerpt ? String(data.excerpt) : null) || buildExcerpt(content);
      const html = marked.parse(content);
      const cover = data.coverImage || data.cover || null;

      return {
        slug,
        transitionName,
        title,
        date,
        category,
        excerpt,
        html,
        cover: cover ? String(cover) : null,
      };
    })
  );

  return posts.filter((post) => post.slug.length > 0);
};

const writeFile = (filePath, contents) => fs.writeFile(filePath, contents, 'utf8');

const run = async () => {
  await ensureDir(outputDir);
  await ensureDir(path.join(outputDir, 'posts'));

  const cssSource = path.join(themeDir, 'styles.css');
  const cssTarget = path.join(outputDir, 'styles.css');
  await fs.copyFile(cssSource, cssTarget);

  const posts = await loadPosts();
  const sortedPosts = [...posts].sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return bTime - aTime;
  });

  const categoriesMap = sortedPosts.reduce((acc, post) => {
    const slug = slugifySegment(post.category);
    if (!slug) {
      return acc;
    }
    const entry = acc.get(slug) ?? { slug, name: post.category, posts: [] };
    entry.posts.push(post);
    acc.set(slug, entry);
    return acc;
  }, new Map());

  const categories = Array.from(categoriesMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  await writeFile(path.join(outputDir, 'index.html'), renderIndex(sortedPosts, categories));
  await ensureDir(path.join(outputDir, 'about'));
  await writeFile(path.join(outputDir, 'about', 'index.html'), renderAbout(categories));

  if (categories.length > 0) {
    await Promise.all(
      categories.map(async (category) => {
        const categoryDir = path.join(outputDir, 'categories', category.slug);
        await ensureDir(categoryDir);
        await writeFile(
          path.join(categoryDir, 'index.html'),
          renderCategoryPage(category, category.posts, categories)
        );
      })
    );
  }

  await Promise.all(
    sortedPosts.map(async (post) => {
      const postDir = path.join(outputDir, 'posts', post.slug);
      await ensureDir(postDir);
      await writeFile(path.join(postDir, 'index.html'), renderPost(post, categories));
    })
  );

  console.log(`Generated ${sortedPosts.length} posts in ${outputDir}`);
};

run().catch((error) => {
  console.error('Generation failed:', error);
  process.exit(1);
});
