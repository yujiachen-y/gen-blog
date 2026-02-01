import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { resolveTranslationKey } from './paths.js';

const SUPPORTED_LANGS = new Set(['zh', 'en']);

const shouldIgnoreDir = (entryName) => entryName.startsWith('.') || entryName === 'node_modules';

const collectMarkdownFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (shouldIgnoreDir(entry.name)) {
          return [];
        }
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

const formatDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
};

const normalizeLanguage = (value) => {
  if (!value) {
    return null;
  }
  const raw = String(value).toLowerCase().trim();
  if (raw === 'zh' || raw.startsWith('zh-')) {
    return 'zh';
  }
  if (raw === 'en' || raw.startsWith('en-')) {
    return 'en';
  }
  return null;
};

const normalizeCategories = (value) => {
  if (!Array.isArray(value)) {
    return null;
  }
  const categories = value.map((item) => String(item || '').trim()).filter(Boolean);
  return categories.length > 0 ? categories : null;
};

export const loadPosts = async (inputDir) => {
  const files = await collectMarkdownFiles(inputDir);
  const errors = [];

  const results = await Promise.all(
    files.map(async (filePath) => {
      const raw = await fs.readFile(filePath, 'utf8');
      const { data, content } = matter(raw);
      const fileErrors = [];

      const blogPublish = data.blog_publish;
      if (blogPublish === undefined) {
        return null;
      }
      if (blogPublish !== true && blogPublish !== false) {
        fileErrors.push(`${filePath}: blog_publish must be true or false`);
      }
      if (blogPublish === false) {
        return null;
      }

      const title = data.blog_title ? String(data.blog_title).trim() : '';
      if (!title) {
        fileErrors.push(`${filePath}: missing blog_title`);
      }

      const date = formatDate(data.blog_date);
      if (!date) {
        fileErrors.push(`${filePath}: invalid blog_date`);
      }

      const lang = normalizeLanguage(data.blog_lang);
      if (!lang || !SUPPORTED_LANGS.has(lang)) {
        fileErrors.push(`${filePath}: invalid blog_lang (must be zh or en)`);
      }

      const translationKey = resolveTranslationKey(data.blog_translation_key);
      if (!translationKey) {
        fileErrors.push(`${filePath}: invalid blog_translation_key (use slug/path)`);
      }

      const categories = normalizeCategories(data.blog_category);
      if (!categories) {
        fileErrors.push(`${filePath}: blog_category must be a non-empty list`);
      }

      const coverImage = data.blog_cover_image ? String(data.blog_cover_image).trim() : null;

      if (fileErrors.length > 0) {
        errors.push(...fileErrors);
        return null;
      }

      return {
        sourcePath: filePath,
        title,
        date,
        lang,
        translationKey,
        categories,
        coverImage,
        content,
      };
    })
  );

  if (errors.length > 0) {
    throw new Error(`Frontmatter validation failed:\n${errors.join('\n')}`);
  }

  return results.filter(Boolean);
};

export const buildPostGroups = (posts) => {
  const grouped = new Map();
  const errors = [];

  posts.forEach((post) => {
    if (!grouped.has(post.translationKey)) {
      grouped.set(post.translationKey, { translationKey: post.translationKey, translations: {} });
    }
    const group = grouped.get(post.translationKey);
    if (group.translations[post.lang]) {
      errors.push(
        `${post.sourcePath}: duplicate translation for ${post.translationKey}/${post.lang}`
      );
      return;
    }
    group.translations[post.lang] = post;
  });

  if (errors.length > 0) {
    throw new Error(`Translation conflicts:\n${errors.join('\n')}`);
  }

  const groups = Array.from(grouped.values()).map((group) => {
    const languages = Object.keys(group.translations).sort((a, b) => a.localeCompare(b));
    const defaultLang = languages.includes('en') ? 'en' : languages[0];
    return {
      ...group,
      languages,
      defaultLang,
    };
  });

  return groups;
};
