import fs from 'node:fs/promises';
import path from 'node:path';
import subsetFont from 'subset-font';

const ensureDir = (dir) => fs.mkdir(dir, { recursive: true });

const dedupeText = (value) => {
  if (!value) {
    return '';
  }
  const seen = new Set();
  return Array.from(value)
    .filter((char) => {
      if (seen.has(char)) {
        return false;
      }
      seen.add(char);
      return true;
    })
    .join('');
};

const subsetFontFile = async (sourcePath, targetPath, text) => {
  const buffer = await fs.readFile(sourcePath);
  const subset = await subsetFont(buffer, text, { targetFormat: 'woff2' });
  await fs.writeFile(targetPath, subset);
};

export const subsetThemeFonts = async ({ sourceDir, targetDir, text }) => {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  await ensureDir(targetDir);

  const fontText = dedupeText(text);
  const safeText = fontText || ' ';

  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);
        if (entry.name.endsWith('.woff2')) {
          await subsetFontFile(sourcePath, targetPath, safeText);
          return;
        }
        await fs.copyFile(sourcePath, targetPath);
      })
  );
};
