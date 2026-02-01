import fs from 'node:fs/promises';
import path from 'node:path';

const shouldIgnoreDir = (entryName) => entryName.startsWith('.') || entryName === 'node_modules';

const collectImageFiles = async (dir, imageExts) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (shouldIgnoreDir(entry.name)) {
          return [];
        }
        return collectImageFiles(fullPath, imageExts);
      }
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (imageExts.has(ext)) {
          return [fullPath];
        }
      }
      return [];
    })
  );

  return nested.flat();
};

const addToIndex = (index, key, filePath) => {
  if (!key) {
    return;
  }
  const normalized = key.toLowerCase();
  const list = index.get(normalized) || [];
  list.push(filePath);
  index.set(normalized, list);
};

export const buildImageIndex = async (dir, imageExts) => {
  const files = await collectImageFiles(dir, imageExts);
  const index = new Map();
  files.forEach((filePath) => {
    const base = path.basename(filePath);
    const name = path.parse(base).name;
    addToIndex(index, base, filePath);
    addToIndex(index, name, filePath);
  });
  return index;
};

export const resolveImageFromIndex = (name, filePath, imageIndex) => {
  if (!name) {
    return null;
  }
  const matches = imageIndex.get(name.toLowerCase()) || [];
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    throw new Error(`${filePath}: ambiguous Obsidian image "${name}" matches multiple files`);
  }
  return null;
};
