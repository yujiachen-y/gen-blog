// The post title is the page's only H1; the body's headings settle in under it.
const normalizeTitleText = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const isTitle = (innerHtml, title) =>
  normalizeTitleText(innerHtml.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ')) ===
  normalizeTitleText(title);

const stripDuplicateTitleHtml = (html, title) => {
  if (!html || !title) return html;
  const match = html.match(/^\s*<h1\b[^>]*>([\s\S]*?)<\/h1>\s*/i);
  if (!match || !isTitle(match[1], title)) return html;
  return html.slice(match[0].length);
};

const filterDuplicateTitleToc = (toc, title) => {
  if (!Array.isArray(toc) || toc.length === 0 || !title) return toc;
  const first = toc[0];
  if (!first || first.level !== 1) return toc;
  if (normalizeTitleText(first.text) !== normalizeTitleText(title)) return toc;
  return toc.slice(1);
};

// A lone H1 leading the body's headings is the body's own title, so it becomes the subtitle
// (or goes, when it only repeats the title); other H1s are sections, so every heading drops a
// level.
const settleBodyHeadings = (html, toc, title) => {
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  if (h1Count === 0) {
    return { html, toc, subtitleHtml: '' };
  }
  const lead = html.match(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/i);
  if (h1Count === 1 && lead[1] === '1') {
    return {
      html: html.replace(lead[0], ''),
      toc: toc.filter((item) => item.level !== 1),
      subtitleHtml: isTitle(lead[2], title) ? '' : lead[2],
    };
  }
  return {
    html: html.replace(/<(\/?)h([1-5])\b/gi, (_, slash, level) => `<${slash}h${Number(level) + 1}`),
    toc: toc.map((item) => ({ ...item, level: item.level + 1 })),
    subtitleHtml: '',
  };
};

export const settleHeadings = (html, toc = [], title = '') =>
  settleBodyHeadings(
    stripDuplicateTitleHtml(html, title),
    filterDuplicateTitleToc(toc, title),
    title
  );
