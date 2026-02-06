import path from 'node:path';

const isObsidianSizeHint = (value) => /^\d+(x\d+)?$/i.test(value);
const toPosixPath = (value) => value.split(path.sep).join('/');

const splitEmbedParts = (inner) => inner.split('|').map((part) => part.trim());

const normalizeEmbedTarget = (target) => {
  const anchorIndex = target.indexOf('#');
  if (anchorIndex === -1) {
    return target.trim();
  }
  return target.slice(0, anchorIndex).trim();
};

const resolveEmbedPath = async ({
  target,
  filePath,
  imageIndex,
  inputDir,
  imageExts,
  pathExists,
  resolveImageFromIndex,
}) => {
  const normalizedTarget = target.replace(/^\/+/, '');
  const ext = path.extname(normalizedTarget).toLowerCase();
  if (ext && !imageExts.has(ext)) {
    throw new Error(`${filePath}: unsupported image format ${ext} in Obsidian embed`);
  }

  const hasPath = normalizedTarget.includes('/') || normalizedTarget.includes('\\');
  const candidates = hasPath
    ? [
        path.resolve(path.dirname(filePath), normalizedTarget),
        path.resolve(inputDir, normalizedTarget),
      ]
    : [path.resolve(path.dirname(filePath), normalizedTarget)];

  for (let i = 0; i < candidates.length; i += 1) {
    if (await pathExists(candidates[i])) {
      return candidates[i];
    }
  }
  return resolveImageFromIndex(path.basename(normalizedTarget), filePath, imageIndex);
};

const buildMarkdownImage = ({ alt, filePath, resolvedPath }) => {
  const relative = toPosixPath(path.relative(path.dirname(filePath), resolvedPath));
  return `![${alt}](${encodeURI(relative)})`;
};

const resolveEmbedReplacement = async ({ embed, filePath, imageIndex, ...context }) => {
  const parts = splitEmbedParts(embed.inner);
  const target = normalizeEmbedTarget(parts.shift() || '');
  if (!target) {
    throw new Error(`${filePath}: empty Obsidian embed`);
  }

  const alt = parts.find((part) => part && !isObsidianSizeHint(part)) || '';
  const resolvedPath = await resolveEmbedPath({
    target,
    filePath,
    imageIndex,
    ...context,
  });
  if (!resolvedPath) {
    throw new Error(`${filePath}: unresolved Obsidian image "${target}"`);
  }
  return buildMarkdownImage({ alt, filePath, resolvedPath });
};

const collectEmbeds = (source) => {
  const embeds = [];
  const pattern = /!\[\[([\s\S]+?)\]\]/g;
  let match = pattern.exec(source);
  while (match) {
    embeds.push({ raw: match[0], inner: match[1] });
    match = pattern.exec(source);
  }
  return embeds;
};

export const replaceObsidianImageEmbeds = async ({
  source,
  filePath,
  imageIndex,
  inputDir,
  imageExts,
  pathExists,
  resolveImageFromIndex,
}) => {
  const embeds = collectEmbeds(source);
  if (embeds.length === 0) {
    return source;
  }

  let output = source;
  for (let i = 0; i < embeds.length; i += 1) {
    const replacement = await resolveEmbedReplacement({
      embed: embeds[i],
      filePath,
      imageIndex,
      inputDir,
      imageExts,
      pathExists,
      resolveImageFromIndex,
    });
    output = output.replace(embeds[i].raw, replacement);
  }
  return output;
};
