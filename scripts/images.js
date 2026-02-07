import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { resolveImageSourceInput } from './image-source.js';

const DEFAULT_MAX_WIDTH = 1080;
const DEFAULT_MAX_IMAGE_BYTES = 1536 * 1024;
const DEFAULT_MIN_WIDTH = 320;
const RESIZE_STEP = 0.85;
const DEFAULT_JPEG_QUALITY = 82;
const DEFAULT_WEBP_QUALITY = 82;
const MIN_JPEG_QUALITY = 60;
const QUALITY_STEP = 5;
const DEFAULT_OUTPUT_BASE = path.resolve('dist/assets');
const DEFAULT_PUBLIC_BASE = '/assets';
const DEFAULT_REMOTE_DIR = 'remote';
const DEFAULT_REMOTE_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_REMOTE_TIMEOUT_MS = 10000;
const DEFAULT_OPTIONS = {
  outputBase: DEFAULT_OUTPUT_BASE,
  sourceBase: null,
  publicBase: DEFAULT_PUBLIC_BASE,
  maxWidth: DEFAULT_MAX_WIDTH,
  minWidth: DEFAULT_MIN_WIDTH,
  maxBytes: DEFAULT_MAX_IMAGE_BYTES,
  resizeStep: RESIZE_STEP,
  jpegQuality: DEFAULT_JPEG_QUALITY,
  webpQuality: DEFAULT_WEBP_QUALITY,
  remoteDir: DEFAULT_REMOTE_DIR,
  remoteMaxBytes: DEFAULT_REMOTE_MAX_BYTES,
  remoteTimeoutMs: DEFAULT_REMOTE_TIMEOUT_MS,
};

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

const resolveOptions = (options = {}) => {
  const merged = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  return {
    ...merged,
    outputBase: path.resolve(merged.outputBase),
    sourceBase: merged.sourceBase ? path.resolve(merged.sourceBase) : null,
  };
};

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

const createResizeState = (metadata, options) => {
  const hasDimensions = Boolean(metadata.width && metadata.height);
  const width = hasDimensions ? Math.min(options.maxWidth, metadata.width) : options.maxWidth;
  return {
    hasDimensions,
    width,
    jpegQuality: options.jpegQuality,
    webpQuality: options.webpQuality,
  };
};

const buildPipelines = ({ input, imageKind, state }) => {
  const resized = buildSharp(input).rotate().resize({
    width: state.width,
    withoutEnlargement: true,
  });
  return {
    webp:
      imageKind === 'jpeg'
        ? resized.clone().webp({ quality: state.webpQuality })
        : resized.clone().webp({ lossless: true }),
    fallback:
      imageKind === 'jpeg'
        ? resized.clone().jpeg({ quality: state.jpegQuality, mozjpeg: true })
        : resized.clone().png({ compressionLevel: 9, adaptiveFiltering: true }),
  };
};

const renderBuffers = async ({ input, imageKind, state }) => {
  const pipelines = buildPipelines({ input, imageKind, state });
  const [webp, fallback] = await Promise.all([
    pipelines.webp.toBuffer(),
    pipelines.fallback.toBuffer(),
  ]);
  return { webp, fallback };
};

const isWithinMaxBytes = (buffers, state, options) =>
  !state.hasDimensions ||
  Math.max(buffers.webp.length, buffers.fallback.length) <= options.maxBytes;

const resolveNextWidth = (state, options) => {
  if (state.width <= options.minWidth) {
    return null;
  }
  const next = Math.max(Math.floor(state.width * options.resizeStep), options.minWidth);
  return next === state.width ? options.minWidth : next;
};

const canLowerJpegQuality = (state) =>
  state.jpegQuality > MIN_JPEG_QUALITY || state.webpQuality > MIN_JPEG_QUALITY;

const getNextResizeState = (state, imageKind, options) => {
  const nextWidth = resolveNextWidth(state, options);
  if (nextWidth !== null) {
    return { ...state, width: nextWidth };
  }
  if (imageKind !== 'jpeg' || !canLowerJpegQuality(state)) {
    return null;
  }
  return {
    ...state,
    jpegQuality: Math.max(state.jpegQuality - QUALITY_STEP, MIN_JPEG_QUALITY),
    webpQuality: Math.max(state.webpQuality - QUALITY_STEP, MIN_JPEG_QUALITY),
  };
};

const optimizeImageBuffers = async ({ input, imageKind, metadata, options }) => {
  let state = createResizeState(metadata, options);
  let buffers = null;

  let keepTrying = true;
  while (keepTrying) {
    buffers = await renderBuffers({ input, imageKind, state });
    if (isWithinMaxBytes(buffers, state, options)) {
      return { buffers, state };
    }
    const next = getNextResizeState(state, imageKind, options);
    if (!next) {
      keepTrying = false;
    } else {
      state = next;
    }
  }
  return { buffers, state };
};

const processImageInput = async ({ input, imageKind, relativePath }, options) => {
  const resolvedOptions = resolveOptions(options);
  const outputPaths = buildOutputPathsFromRelative(relativePath, resolvedOptions, imageKind);
  const outputDir = path.join(resolvedOptions.outputBase, outputPaths.relativeDir);

  await ensureDir(outputDir);

  const metadata = await buildSharp(input).metadata();
  const { buffers, state } = await optimizeImageBuffers({
    input,
    imageKind,
    metadata,
    options: resolvedOptions,
  });
  const targetSize = calculateTargetSize(metadata, state.width);

  await Promise.all([
    fs.writeFile(outputPaths.webp.filePath, buffers.webp),
    fs.writeFile(outputPaths.fallback.filePath, buffers.fallback),
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

export const processImageSource = async (src, options = {}) => {
  const resolvedOptions = resolveOptions(options);
  const sourceInput = await resolveImageSourceInput({
    src,
    options: resolvedOptions,
    relativePath: options.relativePath,
  });
  return processImageInput(sourceInput, resolvedOptions);
};

export const processImages = async (inputPaths, options) => {
  const resolvedOptions = resolveOptions(options);

  return Promise.all(inputPaths.map((inputPath) => processImage(inputPath, resolvedOptions)));
};
