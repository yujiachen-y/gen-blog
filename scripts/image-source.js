import crypto from 'node:crypto';
import path from 'node:path';

const normalizeMime = (value) => {
  if (!value) {
    return null;
  }
  return value.split(';')[0].trim().toLowerCase();
};

const getImageKindFromExt = (ext) => {
  if (ext === '.jpg' || ext === '.jpeg') {
    return 'jpeg';
  }
  if (ext === '.png') {
    return 'png';
  }
  return null;
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
    return getImageKindFromExt(path.extname(url.pathname).toLowerCase());
  } catch {
    return null;
  }
};

const validateRemoteSize = (size, options, src) => {
  if (Number.isFinite(size) && size > options.remoteMaxBytes) {
    throw new Error(
      `Remote image too large (${size} bytes, max ${options.remoteMaxBytes}): ${src}`
    );
  }
};

const fetchRemoteImage = async (src, options) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.remoteTimeoutMs);

  try {
    const response = await fetch(src, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch image (${response.status}): ${src}`);
    }
    const contentType = response.headers.get('content-type');
    validateRemoteSize(Number(response.headers.get('content-length')), options, src);
    const buffer = Buffer.from(await response.arrayBuffer());
    validateRemoteSize(buffer.length, options, src);
    return { buffer, contentType };
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`Remote image fetch timed out after ${options.remoteTimeoutMs}ms: ${src}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const resolveImageSourceInput = async ({ src, options, relativePath }) => {
  if (src.startsWith('data:')) {
    const parsed = parseDataUri(src);
    if (!parsed) {
      throw new Error('Unsupported data URI image');
    }
    const imageKind = getImageKindFromMime(parsed.mime);
    if (!imageKind) {
      throw new Error(`Unsupported data URI mime type: ${parsed.mime}`);
    }
    return {
      input: parsed.buffer,
      imageKind,
      relativePath: relativePath || resolveRemoteRelativePath(parsed.buffer, imageKind, options),
    };
  }

  const { buffer, contentType } = await fetchRemoteImage(src, options);
  const imageKind = inferImageKindFromUrl(src, contentType);
  if (!imageKind) {
    throw new Error(`Unsupported remote image type: ${src}`);
  }
  return {
    input: buffer,
    imageKind,
    relativePath: relativePath || resolveRemoteRelativePath(buffer, imageKind, options),
  };
};
