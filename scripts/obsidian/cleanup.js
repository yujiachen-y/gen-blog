const FENCE_PATTERN = /^(?:```|~~~)/;

const joinSegmentLines = (segment) => segment.lines.join('\n');

const splitFenceAwareSegments = (value) => {
  const lines = value.split('\n');
  const segments = [];
  let current = { isFence: false, lines: [] };
  let inFence = false;
  let fenceToken = '';

  const pushCurrent = () => {
    if (current.lines.length === 0) {
      return;
    }
    segments.push({ isFence: current.isFence, text: joinSegmentLines(current) });
    current = { isFence: inFence, lines: [] };
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(FENCE_PATTERN);
    if (!fenceMatch) {
      current.lines.push(line);
      return;
    }

    if (!inFence) {
      pushCurrent();
      inFence = true;
      fenceToken = fenceMatch[0];
      current = { isFence: true, lines: [line] };
      return;
    }

    current.lines.push(line);
    if (trimmed.startsWith(fenceToken)) {
      inFence = false;
      fenceToken = '';
      pushCurrent();
      current = { isFence: false, lines: [] };
    }
  });

  pushCurrent();
  return segments;
};

const buildNoteCallout = (asideBody) => {
  const normalized = asideBody.split('\n').map((line) => line.replace(/\r$/, ''));
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
    return '> [!note]';
  }
  const title = body[0].trim();
  const output = [title ? `> [!note] ${title}` : '> [!note]'];
  body.slice(1).forEach((line) => {
    output.push(line.trim() === '' ? '>' : `> ${line}`);
  });
  return output.join('\n');
};

const replaceClosedAsides = (segmentText) =>
  segmentText.replace(/<aside\b[^>]*>([\s\S]*?)<\/aside>/gi, (_, body) => buildNoteCallout(body));

const replaceUnclosedAside = (segmentText) => {
  const match = /<aside\b[^>]*>/i.exec(segmentText);
  if (!match) {
    return segmentText;
  }
  const before = segmentText.slice(0, match.index);
  const after = segmentText.slice(match.index + match[0].length);
  return `${before}${buildNoteCallout(after)}`;
};

export const convertHtmlAsidesToCallouts = (value) =>
  splitFenceAwareSegments(value)
    .map((segment) => {
      if (segment.isFence) {
        return segment.text;
      }
      return replaceUnclosedAside(replaceClosedAsides(segment.text));
    })
    .join('\n');

const stripDelimitedInText = ({ text, delimiter, inBlock }) => {
  let cursor = 0;
  let output = '';
  let blockState = inBlock;

  while (cursor < text.length) {
    const idx = text.indexOf(delimiter, cursor);
    if (idx === -1) {
      if (!blockState) {
        output += text.slice(cursor);
      }
      break;
    }
    if (!blockState) {
      output += text.slice(cursor, idx);
    }
    blockState = !blockState;
    cursor = idx + delimiter.length;
  }

  return { output, inBlock: blockState };
};

const stripDelimitedOutsideFences = (value, delimiter) => {
  let inBlock = false;
  return splitFenceAwareSegments(value)
    .map((segment) => {
      if (segment.isFence) {
        return segment.text;
      }
      const result = stripDelimitedInText({
        text: segment.text,
        delimiter,
        inBlock,
      });
      inBlock = result.inBlock;
      return result.output;
    })
    .join('\n');
};

export const stripObsidianComments = (value) =>
  stripDelimitedOutsideFences(value, '%%')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[ \t]*#{1,6}[ \t]*$/gm, '');

export const stripObsidianDeletions = (value) => stripDelimitedOutsideFences(value, '~~');
