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
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

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

const renderLayout = ({ title, cssHref, navPrefix, bodyHtml }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="${cssHref}" />
  </head>
  <body>
    <div class="app">
      <header class="site-header">
        <a class="brand" href="${navPrefix}">Gen Blog</a>
        <nav class="nav">
          <a href="${navPrefix}">Home</a>
          <a href="${navPrefix}about/">About</a>
        </nav>
      </header>

      <main class="view">
        ${bodyHtml}
      </main>

      <footer class="site-footer">
        <span>Generated from markdown</span>
      </footer>
    </div>
  </body>
</html>`;

const renderIndex = (posts) => {
  const cards = posts
    .map(
      (post) => `
        <article class="post-card">
          <div class="post-meta">${escapeHtml(post.date)} · ${escapeHtml(
        post.category
      )}</div>
          <h2>${escapeHtml(post.title)}</h2>
          <p>${escapeHtml(post.excerpt)}</p>
          <a href="./posts/${post.slug}/" aria-label="Read ${escapeHtml(
        post.title
      )}">Read more →</a>
        </article>
      `
    )
    .join('');

  return renderLayout({
    title: 'Gen Blog',
    cssHref: './styles.css',
    navPrefix: './',
    bodyHtml: `
        <section class="hero">
          <h1>Gen Blog</h1>
          <p>Static pages generated from markdown.</p>
        </section>
        <section class="post-list">${cards}</section>
      `
  });
};

const renderAbout = () =>
  renderLayout({
    title: 'About · Gen Blog',
    cssHref: '../styles.css',
    navPrefix: '../',
    bodyHtml: `
      <section class="hero">
        <h1>About</h1>
        <p>This is a generated static blog page using the demo style.</p>
      </section>
    `
  });

const renderPost = (post) => {
  const depth = post.slug.split('/').filter(Boolean).length + 1;
  const navPrefix = '../'.repeat(depth);
  const cssHref = `${navPrefix}styles.css`;

  return renderLayout({
    title: `${post.title} · Gen Blog`,
    cssHref,
    navPrefix,
    bodyHtml: `
      <article class="article">
        <a class="back-link" href="${navPrefix}">← Back to home</a>
        <div class="post-meta">${escapeHtml(post.date)} · ${escapeHtml(
      post.category
    )}</div>
        <h1>${escapeHtml(post.title)}</h1>
        ${post.html}
      </article>
    `
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
      const stat = await fs.stat(filePath);
      const date =
        formatDate(data.date) ?? formatDate(stat.mtime) ?? '1970-01-01';
      const contentTitleMatch = content.match(/^#\s+(.+)$/m);
      const title =
        (data.title ? String(data.title) : null) ||
        (contentTitleMatch ? contentTitleMatch[1].trim() : null) ||
        humanize(path.basename(withoutExt));
      const category =
        (data.category ? String(data.category) : null) ||
        slug.split('/')[0] ||
        'General';
      const excerpt =
        (data.excerpt ? String(data.excerpt) : null) || buildExcerpt(content);
      const html = marked.parse(content);

      return {
        slug,
        title,
        date,
        category,
        excerpt,
        html
      };
    })
  );

  return posts.filter((post) => post.slug.length > 0);
};

const writeFile = (filePath, contents) =>
  fs.writeFile(filePath, contents, 'utf8');

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

  await writeFile(path.join(outputDir, 'index.html'), renderIndex(sortedPosts));
  await ensureDir(path.join(outputDir, 'about'));
  await writeFile(path.join(outputDir, 'about', 'index.html'), renderAbout());

  await Promise.all(
    sortedPosts.map(async (post) => {
      const postDir = path.join(outputDir, 'posts', post.slug);
      await ensureDir(postDir);
      await writeFile(path.join(postDir, 'index.html'), renderPost(post));
    })
  );

  console.log(`Generated ${sortedPosts.length} posts in ${outputDir}`);
};

run().catch((error) => {
  console.error('Generation failed:', error);
  process.exit(1);
});
