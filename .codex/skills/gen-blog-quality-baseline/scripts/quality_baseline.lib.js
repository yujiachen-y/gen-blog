import fs from 'node:fs/promises';
import path from 'node:path';

const toBytes = (mb) => Math.round(mb * 1024 * 1024);
const toKbBytes = (kb) => Math.round(kb * 1024);
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);

export const formatBytes = (bytes) => {
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

const loadJsonIfExists = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
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

const getHomeMetrics = async (distDir) => {
  const homeFiles = [
    path.join(distDir, 'index.html'),
    path.join(distDir, 'app.js'),
    path.join(distDir, 'styles.css'),
  ];
  const homeSizes = await Promise.all(homeFiles.map((file) => getFileSize(file)));
  const homeBytes = homeSizes.filter((size) => size !== null).reduce((sum, size) => sum + size, 0);

  return { homeSizes, homeBytes };
};

const getHtmlMetrics = (files, distDir) => {
  const htmlFiles = files.filter((file) => file.path.toLowerCase().endsWith('.html'));
  const pageHtmlFiles = htmlFiles.filter(
    (file) => path.relative(distDir, file.path) !== 'index.html'
  );
  const pageHtmlSizes = pageHtmlFiles.map((file) => file.size);
  return {
    pageHtmlFiles,
    htmlTotalBytes: htmlFiles.reduce((sum, file) => sum + file.size, 0),
    pageHtmlMaxBytes: pageHtmlSizes.length ? Math.max(...pageHtmlSizes) : 0,
    pageHtmlAvgBytes: pageHtmlSizes.length
      ? Math.round(pageHtmlSizes.reduce((sum, size) => sum + size, 0) / pageHtmlSizes.length)
      : 0,
    pageHtmlP95Bytes: getPercentile(pageHtmlSizes, 0.95),
  };
};

const getImageMetrics = (files, maxCoverKb) => {
  const imageFiles = files.filter((file) =>
    imageExtensions.has(path.extname(file.path).toLowerCase())
  );
  const oversizedImages = imageFiles.filter((file) => file.size > toKbBytes(maxCoverKb));
  return { imageFiles, oversizedImages };
};

const getLargestAssets = (files, distDir) =>
  [...files]
    .sort((a, b) => b.size - a.size)
    .slice(0, 8)
    .map((file) => ({ path: path.relative(distDir, file.path), size: file.size }));

export const collectMetrics = async ({ distDir, maxCoverKb }) => {
  const files = await walkDir(distDir);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const indexJsonPath = path.join(distDir, 'posts', 'index.json');
  const indexJsonSize = await getFileSize(indexJsonPath);
  const indexJson = indexJsonSize === null ? null : await loadJsonIfExists(indexJsonPath);
  const postCount = Array.isArray(indexJson) ? indexJson.length : null;
  const { homeSizes, homeBytes } = await getHomeMetrics(distDir);
  const { pageHtmlFiles, htmlTotalBytes, pageHtmlMaxBytes, pageHtmlAvgBytes, pageHtmlP95Bytes } =
    getHtmlMetrics(files, distDir);
  const { imageFiles, oversizedImages } = getImageMetrics(files, maxCoverKb);
  const largestAssets = getLargestAssets(files, distDir);

  return {
    totalBytes,
    indexJsonSize,
    homeSizes,
    homeBytes,
    htmlTotalBytes,
    pageHtmlMaxBytes,
    oversizedImages,
    stats: {
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
    },
  };
};

export const createResult = ({ distDir, thresholds }) => ({
  distDir,
  thresholds,
  stats: {},
  warnings: [],
  failures: [],
});

const addWarning = (result, condition, message) => {
  if (condition) {
    result.warnings.push(message);
  }
};

export const applyThresholdChecks = ({ result, metrics, thresholds, distDir }) => {
  const { maxIndexMb, maxTotalMb, maxHomeKb, maxCoverKb, maxHtmlMb, maxPageKb } = thresholds;
  const {
    indexJsonSize,
    homeSizes,
    homeBytes,
    totalBytes,
    htmlTotalBytes,
    pageHtmlMaxBytes,
    oversizedImages,
  } = metrics;

  if (indexJsonSize !== null && indexJsonSize > toBytes(maxIndexMb)) {
    result.failures.push(
      `posts/index.json exceeds ${maxIndexMb} MB (${formatBytes(indexJsonSize)})`
    );
  }
  if (homeSizes[0] === null) {
    result.failures.push('Missing dist/index.html');
  }

  addWarning(
    result,
    homeBytes > toKbBytes(maxHomeKb),
    `Home payload exceeds ${maxHomeKb} KB (${formatBytes(homeBytes)})`
  );
  addWarning(
    result,
    totalBytes > toBytes(maxTotalMb),
    `dist size exceeds ${maxTotalMb} MB (${formatBytes(totalBytes)})`
  );
  addWarning(
    result,
    htmlTotalBytes > toBytes(maxHtmlMb),
    `HTML total exceeds ${maxHtmlMb} MB (${formatBytes(htmlTotalBytes)})`
  );
  addWarning(
    result,
    pageHtmlMaxBytes > toKbBytes(maxPageKb),
    `Largest page exceeds ${maxPageKb} KB (${formatBytes(pageHtmlMaxBytes)})`
  );

  if (oversizedImages.length > 0) {
    result.warnings.push(
      `Images above ${maxCoverKb} KB: ${oversizedImages
        .map((entry) => `${path.relative(distDir, entry.path)} (${formatBytes(entry.size)})`)
        .join(', ')}`
    );
  }
};

const printList = (title, items) => {
  if (items.length > 0) {
    console.log(`\n${title}:`);
    items.forEach((item) => console.log(`  - ${item}`));
  }
};

export const printResult = ({ result, stats, distDir, jsonOutput }) => {
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('Gen Blog Quality Baseline');
  console.log(`Dist: ${distDir}`);
  console.log(`Posts: ${stats.postCount ?? 'n/a'}`);
  console.log(`Total size: ${formatBytes(stats.totalBytes)}`);
  console.log(`Home payload: ${formatBytes(stats.homeBytes)}`);
  console.log(`posts/index.json: ${formatBytes(stats.indexJsonSize)}`);
  console.log(`HTML pages: ${stats.htmlPageCount}`);
  console.log(`HTML total: ${formatBytes(stats.htmlTotalBytes)}`);
  console.log(`Largest page: ${formatBytes(stats.pageHtmlMaxBytes)}`);
  console.log(`P95 page size: ${formatBytes(stats.pageHtmlP95Bytes)}`);
  console.log(`Images: ${stats.imageCount}`);
  console.log('Largest assets:');
  stats.largestAssets.forEach((asset) => {
    console.log(`  - ${asset.path} (${formatBytes(asset.size)})`);
  });
  printList('Warnings', result.warnings);
  printList('Failures', result.failures);
};
