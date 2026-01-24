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

const ensureDir = (dir) => fs.mkdir(dir, { recursive: true });

const writeJson = (filePath, data) =>
  fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

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
      const date = formatDate(data.date) ?? formatDate(stat.mtime) ?? '1970-01-01';
      const contentTitleMatch = content.match(/^#\s+(.+)$/m);
      const title =
        (data.title ? String(data.title) : null) ||
        (contentTitleMatch ? contentTitleMatch[1].trim() : null) ||
        humanize(path.basename(withoutExt));
      const category =
        (data.category ? String(data.category) : null) || slug.split('/')[0] || 'General';
      const categorySlug = slugifySegment(category);
      const excerpt = (data.excerpt ? String(data.excerpt) : null) || buildExcerpt(content);
      const html = marked.parse(content);
      const cover = data.coverImage || data.cover || null;

      return {
        slug,
        title,
        date,
        category,
        categorySlug,
        excerpt,
        content: html,
        coverImage: cover ? String(cover) : null,
      };
    })
  );

  return posts.filter((post) => post.slug.length > 0);
};

const copyThemeAssets = async () => {
  await fs.copyFile(path.join(themeDir, 'styles.css'), path.join(outputDir, 'styles.css'));
  await fs.copyFile(path.join(themeDir, 'index.html'), path.join(outputDir, 'index.html'));
  await fs.copyFile(path.join(themeDir, 'app.js'), path.join(outputDir, 'app.js'));
};

const run = async () => {
  await ensureDir(outputDir);
  await ensureDir(path.join(outputDir, 'posts'));

  await copyThemeAssets();

  const posts = await loadPosts();
  const sortedPosts = [...posts].sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return bTime - aTime;
  });

  const indexPayload = sortedPosts.map((post) => ({
    slug: post.slug,
    title: post.title,
    date: post.date,
    category: post.category,
    categorySlug: post.categorySlug,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
  }));

  await writeJson(path.join(outputDir, 'posts', 'index.json'), indexPayload);

  await Promise.all(
    sortedPosts.map(async (post) => {
      const detailPath = path.join(outputDir, 'posts', `${post.slug}.json`);
      await ensureDir(path.dirname(detailPath));
      await writeJson(detailPath, {
        slug: post.slug,
        title: post.title,
        date: post.date,
        category: post.category,
        categorySlug: post.categorySlug,
        excerpt: post.excerpt,
        coverImage: post.coverImage,
        content: post.content,
      });
    })
  );

  console.log(`Generated ${sortedPosts.length} posts in ${outputDir}`);
};

run().catch((error) => {
  console.error('Generation failed:', error);
  process.exit(1);
});
