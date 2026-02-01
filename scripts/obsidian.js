import path from 'node:path';

const convertHtmlAsidesToCallouts = (value) => {
  const lines = value.split('\n');
  const output = [];
  let inAside = false;
  let asideLines = [];
  let inFence = false;
  let fenceToken = '';

  const flushAside = () => {
    const normalized = asideLines.map((line) => line.replace(/\r$/, ''));
    asideLines = [];
    inAside = false;

    let start = 0;
    let end = normalized.length;
    while (start < end && normalized[start].trim() === '') {
      start += 1;
    }
    while (end > start && normalized[end - 1].trim() === '') {
      end -= 1;
    }
    const body = normalized.slice(start, end);
    if (body.length === 0) {
      output.push('> [!note]');
      return;
    }
    const title = body[0].trim();
    output.push(title ? `> [!note] ${title}` : '> [!note]');
    body.slice(1).forEach((line) => {
      if (line.trim() === '') {
        output.push('>');
        return;
      }
      output.push(`> ${line}`);
    });
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(?:```|~~~)/);
    if (!inAside && fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceToken = fenceMatch[0];
      } else if (trimmed.startsWith(fenceToken)) {
        inFence = false;
      }
      output.push(line);
      return;
    }

    if (!inAside && inFence) {
      output.push(line);
      return;
    }

    if (inAside) {
      const lower = line.toLowerCase();
      const endIndex = lower.indexOf('</aside>');
      if (endIndex === -1) {
        asideLines.push(line);
        return;
      }
      asideLines.push(line.slice(0, endIndex));
      flushAside();
      const after = line.slice(endIndex + 8);
      if (after.trim()) {
        output.push(after);
      }
      return;
    }

    const lower = line.toLowerCase();
    const startIndex = lower.indexOf('<aside');
    if (startIndex === -1) {
      output.push(line);
      return;
    }
    const tagEnd = lower.indexOf('>', startIndex);
    if (tagEnd === -1) {
      output.push(line);
      return;
    }
    const before = line.slice(0, startIndex);
    if (before.trim()) {
      output.push(before);
    }
    const afterTag = line.slice(tagEnd + 1);
    const afterLower = afterTag.toLowerCase();
    const endIndex = afterLower.indexOf('</aside>');
    if (endIndex !== -1) {
      asideLines.push(afterTag.slice(0, endIndex));
      flushAside();
      const after = afterTag.slice(endIndex + 8);
      if (after.trim()) {
        output.push(after);
      }
      return;
    }
    inAside = true;
    asideLines.push(afterTag);
  });

  if (inAside) {
    flushAside();
  }

  return output.join('\n');
};

const stripObsidianComments = (value) => {
  const lines = value.split('\n');
  const output = [];
  let inBlock = false;
  let inFence = false;
  let fenceToken = '';

  lines.forEach((line) => {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(?:```|~~~)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceToken = fenceMatch[0];
      } else if (trimmed.startsWith(fenceToken)) {
        inFence = false;
      }
      output.push(line);
      return;
    }

    if (inFence) {
      output.push(line);
      return;
    }

    let cursor = 0;
    let buffer = '';

    while (cursor < line.length) {
      const idx = line.indexOf('%%', cursor);
      if (idx === -1) {
        if (!inBlock) {
          buffer += line.slice(cursor);
        }
        break;
      }

      if (!inBlock) {
        buffer += line.slice(cursor, idx);
        inBlock = true;
      } else {
        inBlock = false;
      }

      cursor = idx + 2;
    }

    output.push(buffer);
  });

  return output
    .join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[ \t]*#{1,6}[ \t]*$/gm, '');
};

const stripObsidianDeletions = (value) => {
  const lines = value.split('\n');
  const output = [];
  let inDeletion = false;
  let inFence = false;
  let fenceToken = '';

  lines.forEach((line) => {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(?:```|~~~)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceToken = fenceMatch[0];
      } else if (trimmed.startsWith(fenceToken)) {
        inFence = false;
      }
      output.push(line);
      return;
    }

    if (inFence) {
      output.push(line);
      return;
    }

    let cursor = 0;
    let buffer = '';
    while (cursor < line.length) {
      const idx = line.indexOf('~~', cursor);
      if (idx === -1) {
        if (!inDeletion) {
          buffer += line.slice(cursor);
        }
        break;
      }

      if (!inDeletion) {
        buffer += line.slice(cursor, idx);
        inDeletion = true;
      } else {
        inDeletion = false;
      }
      cursor = idx + 2;
    }
    output.push(buffer);
  });

  return output.join('\n');
};

const isObsidianSizeHint = (value) => /^\d+(x\d+)?$/i.test(value);
const toPosixPath = (value) => value.split(path.sep).join('/');

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
    const candidate = candidates[i];
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return resolveImageFromIndex(path.basename(normalizedTarget), filePath, imageIndex);
};

const replaceObsidianImageEmbeds = async ({
  source,
  filePath,
  imageIndex,
  inputDir,
  imageExts,
  pathExists,
  resolveImageFromIndex,
}) => {
  const embeds = [];
  const pattern = /!\[\[([\s\S]+?)\]\]/g;
  let match = pattern.exec(source);
  while (match) {
    embeds.push({ raw: match[0], inner: match[1] });
    match = pattern.exec(source);
  }

  if (embeds.length === 0) {
    return source;
  }

  let output = source;
  for (let i = 0; i < embeds.length; i += 1) {
    const embed = embeds[i];
    const parts = embed.inner.split('|').map((part) => part.trim());
    let target = parts.shift() || '';
    const anchorIndex = target.indexOf('#');
    if (anchorIndex !== -1) {
      target = target.slice(0, anchorIndex);
    }
    target = target.trim();
    if (!target) {
      throw new Error(`${filePath}: empty Obsidian embed`);
    }

    const alt = parts.find((part) => part && !isObsidianSizeHint(part)) || '';
    const resolved = await resolveEmbedPath({
      target,
      filePath,
      imageIndex,
      inputDir,
      imageExts,
      pathExists,
      resolveImageFromIndex,
    });
    if (!resolved) {
      throw new Error(`${filePath}: unresolved Obsidian image "${target}"`);
    }
    const relative = toPosixPath(path.relative(path.dirname(filePath), resolved));
    const encoded = encodeURI(relative);
    const replacement = `![${alt}](${encoded})`;
    output = output.replace(embed.raw, replacement);
  }

  return output;
};

export const preprocessObsidianContent = async ({
  source,
  filePath,
  imageIndex,
  inputDir,
  imageExts,
  pathExists,
  resolveImageFromIndex,
}) => {
  const withAsides = convertHtmlAsidesToCallouts(source);
  const stripped = stripObsidianComments(withAsides);
  const cleaned = stripObsidianDeletions(stripped);
  return replaceObsidianImageEmbeds({
    source: cleaned,
    filePath,
    imageIndex,
    inputDir,
    imageExts,
    pathExists,
    resolveImageFromIndex,
  });
};
