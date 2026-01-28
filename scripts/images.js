import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DEFAULT_MAX_WIDTH = 680;
const DEFAULT_MAX_IMAGE_BYTES = 600 * 1024;
const DEFAULT_MIN_WIDTH = 240;
const RESIZE_STEP = 0.85;
const DEFAULT_JPEG_QUALITY = 70;
const DEFAULT_WEBP_QUALITY = 70;
const MIN_JPEG_QUALITY = 55;
const QUALITY_STEP = 5;
const DEFAULT_OUTPUT_BASE = path.resolve('dist/assets');
const DEFAULT_PUBLIC_BASE = '/assets';
const DEFAULT_REMOTE_DIR = 'remote';

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

const normalizeMime = (value) => {
  if (!value) {
    return null;
  }
  return value.split(';')[0].trim().toLowerCase();
};

const getImageKindFromMime = (mime) => {
  if (!mime) {
    return null;
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return 'jpeg';
  }
  if (mime === 'image/png') {
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
  minWidth: options.minWidth ?? DEFAULT_MIN_WIDTH,
  maxBytes: options.maxBytes ?? DEFAULT_MAX_IMAGE_BYTES,
  resizeStep: options.resizeStep ?? RESIZE_STEP,
  jpegQuality: options.jpegQuality ?? DEFAULT_JPEG_QUALITY,
  webpQuality: options.webpQuality ?? DEFAULT_WEBP_QUALITY,
  remoteDir: options.remoteDir ?? DEFAULT_REMOTE_DIR,
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

const buildOutputPathsFromRelative = (relativePath, options, imageKind) => {
  const parsed = path.parse(relativePath);
  const baseName = parsed.name;
  const relativeDir = parsed.dir;
  const fallbackExt = imageKind === 'jpeg' ? '.jpg' : '.png';
  const webpRelativePath = path.join(relativeDir, `${baseName}.webp`);
  const fallbackRelativePath = path.join(relativeDir, `${baseName}${fallbackExt}`);

  return {
    relativeDir,
    relativePath,
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

const buildSharp = (input) => sharp(input, { failOnError: true });

const processImageInput = async ({ input, imageKind, relativePath }, options) => {
  const resolvedOptions = resolveOptions(options);
  const outputPaths = buildOutputPathsFromRelative(relativePath, resolvedOptions, imageKind);
  const outputDir = path.join(resolvedOptions.outputBase, outputPaths.relativeDir);

  await ensureDir(outputDir);

  const metadata = await buildSharp(input).metadata();
  const maxWidth = resolvedOptions.maxWidth;
  const maxBytes = resolvedOptions.maxBytes;
  const minWidth = resolvedOptions.minWidth;
  const resizeStep = resolvedOptions.resizeStep;
  let jpegQuality = resolvedOptions.jpegQuality;
  let webpQuality = resolvedOptions.webpQuality;
  const hasDimensions = Boolean(metadata.width && metadata.height);
  const initialWidth = hasDimensions ? Math.min(maxWidth, metadata.width) : maxWidth;

  let currentWidth = initialWidth;
  let webpBuffer = null;
  let fallbackBuffer = null;

  let shouldResize = true;
  while (shouldResize) {
    const resized = buildSharp(input).rotate().resize({
      width: currentWidth,
      withoutEnlargement: true,
    });

    const webpPipeline =
      imageKind === 'jpeg'
        ? resized.clone().webp({ quality: webpQuality })
        : resized.clone().webp({ lossless: true });

    const fallbackPipeline =
      imageKind === 'jpeg'
        ? resized.clone().jpeg({ quality: jpegQuality, mozjpeg: true })
        : resized.clone().png({ compressionLevel: 9, adaptiveFiltering: true });

    [webpBuffer, fallbackBuffer] = await Promise.all([
      webpPipeline.toBuffer(),
      fallbackPipeline.toBuffer(),
    ]);

    const largestSize = Math.max(webpBuffer.length, fallbackBuffer.length);
    if (!hasDimensions || largestSize <= maxBytes) {
      shouldResize = false;
      break;
    }
    if (currentWidth > minWidth) {
      const nextWidth = Math.max(Math.floor(currentWidth * resizeStep), minWidth);
      if (nextWidth === currentWidth) {
        currentWidth = minWidth;
      } else {
        currentWidth = nextWidth;
      }
      continue;
    }
    if (
      imageKind === 'jpeg' &&
      (jpegQuality > MIN_JPEG_QUALITY || webpQuality > MIN_JPEG_QUALITY)
    ) {
      jpegQuality = Math.max(jpegQuality - QUALITY_STEP, MIN_JPEG_QUALITY);
      webpQuality = Math.max(webpQuality - QUALITY_STEP, MIN_JPEG_QUALITY);
      continue;
    }
    shouldResize = false;
  }

  const targetSize = calculateTargetSize(metadata, currentWidth);

  await Promise.all([
    fs.writeFile(outputPaths.webp.filePath, webpBuffer),
    fs.writeFile(outputPaths.fallback.filePath, fallbackBuffer),
  ]);

  return {
    input,
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

export const processImage = async (inputPath, options = {}) => {
  const resolvedOptions = resolveOptions(options);
  const ext = normalizeExt(inputPath);
  const imageKind = getImageKind(ext);

  if (!imageKind) {
    throw new Error(`Unsupported image format: ${ext}`);
  }

  const relativePath =
    options.relativePath || resolveRelativePath(inputPath, resolvedOptions.sourceBase);
  return processImageInput({ input: inputPath, imageKind, relativePath }, resolvedOptions);
};

const parseDataUri = (src) => {
  const match = /^data:([^;,]+);base64,(.*)$/i.exec(src);
  if (!match) {
    return null;
  }
  const mime = normalizeMime(match[1]);
  const data = match[2].trim();
  if (!mime || !data) {
    return null;
  }
  return { mime, buffer: Buffer.from(data, 'base64') };
};

const hashBuffer = (buffer) => crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 16);

const resolveRemoteRelativePath = (buffer, imageKind, options) => {
  const hash = hashBuffer(buffer);
  const ext = imageKind === 'jpeg' ? '.jpg' : '.png';
  return path.join(options.remoteDir, `${hash}${ext}`);
};

const inferImageKindFromUrl = (src, contentType) => {
  const fromMime = getImageKindFromMime(normalizeMime(contentType));
  if (fromMime) {
    return fromMime;
  }

  try {
    const url = new URL(src);
    return getImageKind(path.extname(url.pathname).toLowerCase());
  } catch {
    return null;
  }
};

const fetchRemoteImage = async (src) => {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status}): ${src}`);
  }
  const contentType = response.headers.get('content-type');
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
};

export const processImageSource = async (src, options = {}) => {
  const resolvedOptions = resolveOptions(options);

  if (src.startsWith('data:')) {
    const parsed = parseDataUri(src);
    if (!parsed) {
      throw new Error('Unsupported data URI image');
    }
    const imageKind = getImageKindFromMime(parsed.mime);
    if (!imageKind) {
      throw new Error(`Unsupported data URI mime type: ${parsed.mime}`);
    }
    const relativePath =
      options.relativePath || resolveRemoteRelativePath(parsed.buffer, imageKind, resolvedOptions);
    return processImageInput({ input: parsed.buffer, imageKind, relativePath }, resolvedOptions);
  }

  const { buffer, contentType } = await fetchRemoteImage(src);
  const imageKind = inferImageKindFromUrl(src, contentType);
  if (!imageKind) {
    throw new Error(`Unsupported remote image type: ${src}`);
  }
  const relativePath =
    options.relativePath || resolveRemoteRelativePath(buffer, imageKind, resolvedOptions);
  return processImageInput({ input: buffer, imageKind, relativePath }, resolvedOptions);
};

export const processImages = async (inputPaths, options) => {
  const resolvedOptions = resolveOptions(options);

  return Promise.all(inputPaths.map((inputPath) => processImage(inputPath, resolvedOptions)));
};
