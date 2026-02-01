import fs from 'node:fs/promises';
import path from 'node:path';

export const ensureDir = (dir) => fs.mkdir(dir, { recursive: true });

export const writeFile = (filePath, data) => fs.writeFile(filePath, data, 'utf8');

export const writeJson = (filePath, data) =>
  fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

export const pathExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
};

export const shouldPreserveOutput = async (dir) => {
  if (!(await pathExists(dir))) {
    return false;
  }
  const markers = ['.git', 'CNAME', '.nojekyll'];
  const hits = await Promise.all(markers.map((marker) => pathExists(path.join(dir, marker))));
  return hits.some(Boolean);
};

export const syncDirectory = async (sourceDir, targetDir, preserve = new Set()) => {
  await ensureDir(targetDir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      if (entry.isDirectory()) {
        await syncDirectory(srcPath, targetPath);
        return;
      }
      if (entry.isFile()) {
        await fs.copyFile(srcPath, targetPath);
      }
    })
  );

  const targetEntries = await fs.readdir(targetDir, { withFileTypes: true });
  const sourceNames = new Set(entries.map((entry) => entry.name));
  await Promise.all(
    targetEntries.map(async (entry) => {
      if (preserve.has(entry.name) || sourceNames.has(entry.name)) {
        return;
      }
      await fs.rm(path.join(targetDir, entry.name), { recursive: true, force: true });
    })
  );
};

export const writePage = async (targetDir, html) => {
  await ensureDir(targetDir);
  await writeFile(path.join(targetDir, 'index.html'), html);
};
