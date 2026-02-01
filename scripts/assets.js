import fs from 'node:fs/promises';
import path from 'node:path';
import { subsetThemeFonts } from './fonts.js';
import { THEME_CONSTANTS } from '../theme.constants.js';

const ensureDir = (dir) => fs.mkdir(dir, { recursive: true });

const pathExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
};

const copyDir = async (sourceDir, targetDir) => {
  if (!(await pathExists(sourceDir))) {
    return;
  }
  await ensureDir(targetDir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(sourceDir, entry.name);
      const destPath = path.join(targetDir, entry.name);
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
        return;
      }
      if (entry.isFile()) {
        await fs.copyFile(srcPath, destPath);
      }
    })
  );
};

const copyFuseAssets = async (targetDir) => {
  const fusePath = path.resolve('node_modules/fuse.js/dist/fuse.mjs');
  if (await pathExists(fusePath)) {
    await fs.copyFile(fusePath, path.join(targetDir, 'fuse.mjs'));
  }
};

const copyKatexAssets = async (targetDir) => {
  const katexDir = path.resolve('node_modules/katex/dist');
  if (!(await pathExists(katexDir))) {
    return;
  }
  const targetKatexDir = path.join(targetDir, 'katex');
  const targetFontsDir = path.join(targetKatexDir, 'fonts');
  await ensureDir(targetFontsDir);
  await fs.copyFile(
    path.join(katexDir, 'katex.min.css'),
    path.join(targetKatexDir, 'katex.min.css')
  );

  const entries = await fs.readdir(path.join(katexDir, 'fonts'), { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) =>
        fs.copyFile(path.join(katexDir, 'fonts', entry.name), path.join(targetFontsDir, entry.name))
      )
  );
};

export const copyThemeAssets = async ({ targetDir, themeDir, fontText, themeAssets }) => {
  await fs.copyFile(path.join(themeDir, 'styles.css'), path.join(targetDir, 'styles.css'));
  await fs.copyFile(path.join(themeDir, 'app.js'), path.join(targetDir, 'app.js'));
  await copyDir(path.join(themeDir, 'app'), path.join(targetDir, 'app'));

  if (themeAssets && themeAssets.fontsCssPath) {
    await fs.copyFile(
      themeAssets.fontsCssPath,
      path.join(targetDir, THEME_CONSTANTS.assets.fontsCss)
    );
  }

  if (themeAssets && themeAssets.fontsDir) {
    try {
      const targetFontsDir = path.join(targetDir, THEME_CONSTANTS.assets.fontsDir);
      if (fontText) {
        await subsetThemeFonts({
          sourceDir: themeAssets.fontsDir,
          targetDir: targetFontsDir,
          text: fontText,
        });
      } else {
        const entries = await fs.readdir(themeAssets.fontsDir, { withFileTypes: true });
        await ensureDir(targetFontsDir);
        await Promise.all(
          entries
            .filter((entry) => entry.isFile())
            .map((entry) =>
              fs.copyFile(
                path.join(themeAssets.fontsDir, entry.name),
                path.join(targetFontsDir, entry.name)
              )
            )
        );
      }
    } catch (error) {
      if (error && error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  if (themeAssets && themeAssets.icons.length > 0) {
    await Promise.all(
      themeAssets.icons.map((icon) =>
        fs.copyFile(icon.sourcePath, path.join(targetDir, path.basename(icon.sourcePath)))
      )
    );
  }

  await copyKatexAssets(targetDir);
  await copyFuseAssets(targetDir);
};
