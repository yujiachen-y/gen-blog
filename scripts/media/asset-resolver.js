import path from 'node:path';

export const decodeUriSafe = (value) => {
  try {
    return decodeURI(value);
  } catch (error) {
    return value;
  }
};

export const isRemoteAsset = (src) => /^https?:\/\//i.test(src);
export const isDataAsset = (src) => src.startsWith('data:');
export const isExternalAsset = (src) => isRemoteAsset(src) || isDataAsset(src);

export const resolveLocalAsset = ({ src, filePath, inputDir }) => {
  if (!src) {
    return null;
  }

  const trimmed = src.startsWith('/') ? src.slice(1) : src;
  const resolved = src.startsWith('/')
    ? path.join(inputDir, trimmed)
    : path.resolve(path.dirname(filePath), trimmed);
  const relative = path.relative(inputDir, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return resolved;
};
