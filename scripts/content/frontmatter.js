// The post header as its source frontmatter: what the note says about itself.
import { escapeHtml } from '../shared/templates.js';
import { formatMinutes, formatWords, readingMinutes } from '../../theme/app/reading.js';

const row = (key, valueHtml) => `\n    <div><dt>${key}</dt><dd>${valueHtml}</dd></div>`;

const buildLangHtml = (post) => {
  if (!post.langSwitchUrl || !Array.isArray(post.languages) || post.languages.length < 2) {
    return '';
  }
  const items = post.languages.map((lang) =>
    lang === post.lang
      ? `<span aria-current="true">${escapeHtml(lang)}</span>`
      : `<a href="${escapeHtml(post.langSwitchUrl)}" hreflang="${escapeHtml(lang)}">${escapeHtml(lang)}</a>`
  );
  return row('lang', items.join(' · '));
};

export const buildFrontmatterHtml = (post) => {
  const tags = (post.categories || []).map((cat) => `#${escapeHtml(cat.toLowerCase())}`);
  const words = post.wordCount || 0;
  const reading = `${formatWords(words, post.lang)} · ${formatMinutes(
    readingMinutes(words, post.lang),
    post.lang
  )}`;
  return `\n  <dl class="frontmatter">${row('date', `<time datetime="${escapeHtml(post.date)}">${escapeHtml(post.date)}</time>`)}${
    tags.length ? row('tags', tags.join(' ')) : ''
  }${row('length', escapeHtml(reading))}${buildLangHtml(post)}\n  </dl>`;
};
