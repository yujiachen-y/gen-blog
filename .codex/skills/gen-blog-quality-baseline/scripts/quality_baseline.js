#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);

const getArgValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  if (index === -1) {
    return fallback;
  }
  const value = args[index + 1];
  return value ?? fallback;
};

const hasFlag = (flag) => args.includes(flag);

const distDir = path.resolve(getArgValue('--dist', 'dist'));
const maxIndexMb = Number(getArgValue('--max-index-mb', '2'));
const maxTotalMb = Number(getArgValue('--max-total-mb', '50'));
const maxHomeKb = Number(getArgValue('--max-home-kb', '1024'));
const maxCoverKb = Number(getArgValue('--max-cover-kb', '600'));
const maxHtmlMb = Number(getArgValue('--max-html-mb', '15'));
const maxPageKb = Number(getArgValue('--max-page-kb', '400'));
const warnOnly = hasFlag('--warn-only');
const jsonOutput = hasFlag('--json');

const toBytes = (mb) => Math.round(mb * 1024 * 1024);
const toKbBytes = (kb) => Math.round(kb * 1024);

const formatBytes = (bytes) => {
  if (bytes === null || Number.isNaN(bytes)) {
    return 'n/a';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

const walkDir = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walkDir(fullPath);
      }
      if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        return [{ path: fullPath, size: stat.size }];
      }
      return [];
    })
  );
  return files.flat();
};

const loadJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const loadJsonIfExists = async (filePath) => {
  try {
    return await loadJson(filePath);
  } catch (error) {
    return null;
  }
};

const getFileSize = async (filePath) => {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch (error) {
    return null;
  }
};

const getPercentile = (values, percentile) => {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(percentile * (sorted.length - 1)));
  return sorted[index];
};

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);

const run = async () => {
  const result = {
    distDir,
    thresholds: {
      maxIndexMb,
      maxTotalMb,
      maxHomeKb,
      maxCoverKb,
      maxHtmlMb,
      maxPageKb,
    },
    stats: {},
    warnings: [],
    failures: [],
  };

  const files = await walkDir(distDir);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  const indexJsonPath = path.join(distDir, 'posts', 'index.json');
  const indexJsonSize = await getFileSize(indexJsonPath);

  const homeFiles = [
    path.join(distDir, 'index.html'),
    path.join(distDir, 'app.js'),
    path.join(distDir, 'styles.css'),
  ];

  const homeSizes = await Promise.all(homeFiles.map((file) => getFileSize(file)));
  const homeBytes = homeSizes.filter((size) => size !== null).reduce((sum, size) => sum + size, 0);

  const indexJson = indexJsonSize === null ? null : await loadJsonIfExists(indexJsonPath);
  const postCount = Array.isArray(indexJson) ? indexJson.length : null;

  const htmlFiles = files.filter((file) => file.path.toLowerCase().endsWith('.html'));
  const pageHtmlFiles = htmlFiles.filter(
    (file) => path.relative(distDir, file.path) !== 'index.html'
  );
  const pageHtmlSizes = pageHtmlFiles.map((file) => file.size);
  const pageHtmlMaxBytes = pageHtmlSizes.length ? Math.max(...pageHtmlSizes) : 0;
  const pageHtmlAvgBytes = pageHtmlSizes.length
    ? Math.round(pageHtmlSizes.reduce((sum, size) => sum + size, 0) / pageHtmlSizes.length)
    : 0;
  const pageHtmlP95Bytes = getPercentile(pageHtmlSizes, 0.95);
  const htmlTotalBytes = htmlFiles.reduce((sum, file) => sum + file.size, 0);

  const imageFiles = files.filter((file) =>
    imageExtensions.has(path.extname(file.path).toLowerCase())
  );
  const oversizedImages = imageFiles.filter((file) => file.size > toKbBytes(maxCoverKb));

  if (indexJsonSize !== null && indexJsonSize > toBytes(maxIndexMb)) {
    result.failures.push(
      `posts/index.json exceeds ${maxIndexMb} MB (${formatBytes(indexJsonSize)})`
    );
  }

  if (homeSizes[0] === null) {
    result.failures.push('Missing dist/index.html');
  }

  if (homeBytes > toKbBytes(maxHomeKb)) {
    result.warnings.push(`Home payload exceeds ${maxHomeKb} KB (${formatBytes(homeBytes)})`);
  }

  if (totalBytes > toBytes(maxTotalMb)) {
    result.warnings.push(`dist size exceeds ${maxTotalMb} MB (${formatBytes(totalBytes)})`);
  }

  if (htmlTotalBytes > toBytes(maxHtmlMb)) {
    result.warnings.push(`HTML total exceeds ${maxHtmlMb} MB (${formatBytes(htmlTotalBytes)})`);
  }

  if (pageHtmlMaxBytes > toKbBytes(maxPageKb)) {
    result.warnings.push(`Largest page exceeds ${maxPageKb} KB (${formatBytes(pageHtmlMaxBytes)})`);
  }

  if (oversizedImages.length > 0) {
    result.warnings.push(
      `Images above ${maxCoverKb} KB: ${oversizedImages
        .map((entry) => `${path.relative(distDir, entry.path)} (${formatBytes(entry.size)})`)
        .join(', ')}`
    );
  }

  const largestAssets = [...files]
    .sort((a, b) => b.size - a.size)
    .slice(0, 8)
    .map((file) => ({
      path: path.relative(distDir, file.path),
      size: file.size,
    }));

  result.stats = {
    postCount,
    totalBytes,
    homeBytes,
    indexJsonSize,
    htmlPageCount: pageHtmlFiles.length,
    htmlTotalBytes,
    pageHtmlMaxBytes,
    pageHtmlAvgBytes,
    pageHtmlP95Bytes,
    imageCount: imageFiles.length,
    largestAssets,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Gen Blog Quality Baseline');
    console.log(`Dist: ${distDir}`);
    console.log(`Posts: ${postCount ?? 'n/a'}`);
    console.log(`Total size: ${formatBytes(totalBytes)}`);
    console.log(`Home payload: ${formatBytes(homeBytes)}`);
    console.log(`posts/index.json: ${formatBytes(indexJsonSize)}`);
    console.log(`HTML pages: ${pageHtmlFiles.length}`);
    console.log(`HTML total: ${formatBytes(htmlTotalBytes)}`);
    console.log(`Largest page: ${formatBytes(pageHtmlMaxBytes)}`);
    console.log(`P95 page size: ${formatBytes(pageHtmlP95Bytes)}`);
    console.log(`Images: ${imageFiles.length}`);
    console.log('Largest assets:');
    largestAssets.forEach((asset) => {
      console.log(`  - ${asset.path} (${formatBytes(asset.size)})`);
    });

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach((warning) => console.log(`  - ${warning}`));
    }

    if (result.failures.length > 0) {
      console.log('\nFailures:');
      result.failures.forEach((failure) => console.log(`  - ${failure}`));
    }
  }

  if (!warnOnly && result.failures.length > 0) {
    process.exit(1);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
