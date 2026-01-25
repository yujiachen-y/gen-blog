import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DEFAULT_MAX_WIDTH = 2000;
const DEFAULT_OUTPUT_BASE = path.resolve('dist/assets');
const DEFAULT_PUBLIC_BASE = '/assets';

const ensureDir = (dir) => fs.mkdir(dir, { recursive: true });

const normalizeExt = (filePath) => path.extname(filePath).toLowerCase();

const getImageKind = (ext) => {
  if (ext === '.jpg' || ext === '.jpeg') {
    return 'jpeg';
  }
  if (ext === '.png') {
    return 'png';
  }
  return null;
};

const toPosixPath = (value) => value.split(path.sep).join('/');

const buildPublicPath = (publicBase, relativePath) => {
  if (publicBase === null || publicBase === undefined) {
    return null;
  }

  return path.posix.join(publicBase, toPosixPath(relativePath));
};

const resolveRelativePath = (inputPath, sourceBase) => {
  if (!sourceBase) {
    return path.basename(inputPath);
  }

  const relative = path.relative(sourceBase, inputPath);
  const isUnsafe = relative.startsWith('..') || path.isAbsolute(relative);

  return isUnsafe ? path.basename(inputPath) : relative;
};

const resolveOptions = (options = {}) => ({
  outputBase: options.outputBase ? path.resolve(options.outputBase) : DEFAULT_OUTPUT_BASE,
  sourceBase: options.sourceBase ? path.resolve(options.sourceBase) : null,
  publicBase: options.publicBase ?? DEFAULT_PUBLIC_BASE,
  maxWidth: options.maxWidth ?? DEFAULT_MAX_WIDTH,
});

const calculateTargetSize = (metadata, maxWidth) => {
  if (!metadata.width || !metadata.height) {
    return { width: null, height: null };
  }

  const scale = Math.min(1, maxWidth / metadata.width);

  return {
    width: Math.round(metadata.width * scale),
    height: Math.round(metadata.height * scale),
  };
};

const buildOutputPaths = (inputPath, options, imageKind) => {
  const ext = normalizeExt(inputPath);
  const relativePath = resolveRelativePath(inputPath, options.sourceBase);
  const parsed = path.parse(relativePath);
  const baseName = parsed.name;
  const relativeDir = parsed.dir;
  const fallbackExt = imageKind === 'jpeg' ? '.jpg' : '.png';
  const webpRelativePath = path.join(relativeDir, `${baseName}.webp`);
  const fallbackRelativePath = path.join(relativeDir, `${baseName}${fallbackExt}`);

  return {
    relativeDir,
    relativePath,
    ext,
    webp: {
      relativePath: webpRelativePath,
      filePath: path.join(options.outputBase, webpRelativePath),
      publicPath: buildPublicPath(options.publicBase, webpRelativePath),
      type: 'image/webp',
    },
    fallback: {
      relativePath: fallbackRelativePath,
      filePath: path.join(options.outputBase, fallbackRelativePath),
      publicPath: buildPublicPath(options.publicBase, fallbackRelativePath),
      type: imageKind === 'jpeg' ? 'image/jpeg' : 'image/png',
    },
  };
};

export const processImage = async (inputPath, options) => {
  const resolvedOptions = resolveOptions(options);
  const ext = normalizeExt(inputPath);
  const imageKind = getImageKind(ext);

  if (!imageKind) {
    throw new Error(`Unsupported image format: ${ext}`);
  }

  const outputPaths = buildOutputPaths(inputPath, resolvedOptions, imageKind);
  const outputDir = path.join(resolvedOptions.outputBase, outputPaths.relativeDir);

  await ensureDir(outputDir);

  const metadata = await sharp(inputPath, { failOnError: true }).metadata();
  const targetSize = calculateTargetSize(metadata, resolvedOptions.maxWidth);

  const resized = sharp(inputPath, { failOnError: true }).rotate().resize({
    width: resolvedOptions.maxWidth,
    withoutEnlargement: true,
  });

  const webpPipeline =
    imageKind === 'jpeg'
      ? resized.clone().webp({ quality: 80 })
      : resized.clone().webp({ lossless: true });

  const fallbackPipeline =
    imageKind === 'jpeg'
      ? resized.clone().jpeg({ quality: 80, mozjpeg: true })
      : resized.clone().png({ compressionLevel: 9, adaptiveFiltering: true });

  await Promise.all([
    webpPipeline.toFile(outputPaths.webp.filePath),
    fallbackPipeline.toFile(outputPaths.fallback.filePath),
  ]);

  return {
    inputPath,
    format: imageKind,
    width: targetSize.width,
    height: targetSize.height,
    outputBase: resolvedOptions.outputBase,
    outputs: {
      webp: outputPaths.webp,
      fallback: outputPaths.fallback,
    },
    picture:
      outputPaths.webp.publicPath && outputPaths.fallback.publicPath
        ? {
            sources: [{ src: outputPaths.webp.publicPath, type: outputPaths.webp.type }],
            img: {
              src: outputPaths.fallback.publicPath,
              type: outputPaths.fallback.type,
              width: targetSize.width,
              height: targetSize.height,
            },
          }
        : null,
  };
};

export const processImages = async (inputPaths, options) => {
  const resolvedOptions = resolveOptions(options);

  return Promise.all(inputPaths.map((inputPath) => processImage(inputPath, resolvedOptions)));
};
