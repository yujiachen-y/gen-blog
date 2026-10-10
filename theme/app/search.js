// Nav search: ⌘K or / opens a panel that searches titles and full text.
// The index is fetched on first open, so pages that never search pay nothing.
import { state } from './state.js';
import { ageOf } from './age.js';

const INDEX_URL = '/posts/search-index.json';
const RECENT_COUNT = 5;
const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>';

const COPY = {
  zh: {
    label: '搜索',
    placeholder: '搜标题或正文，比如 OpenAI、事务、无明',
    titles: '标题',
    texts: '正文',
    recent: '最近写的',
    hints: '↑↓ 选择 · ↵ 打开 · esc 关闭',
    count: (n) => `${n} 篇`,
    empty: (q) => `没有文章提到「${q}」。换个词试试。`,
    failed: '搜索索引没加载上。刷新页面再试一次。',
  },
  en: {
    label: 'Search',
    placeholder: 'Search titles and text, e.g. OpenAI, consensus',
    titles: 'Titles',
    texts: 'In the text',
    recent: 'Recent',
    hints: '↑↓ select · ↵ open · esc close',
    count: (n) => `${n} ${n === 1 ? 'post' : 'posts'}`,
    empty: (q) => `No post mentions “${q}”. Try another word.`,
    failed: 'The search index didn’t load. Refresh the page and try again.',
  },
};

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  );
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlight = (text, terms) =>
  terms.reduce(
    (html, term) =>
      html.replace(new RegExp(escapeRegExp(escapeHtml(term)), 'gi'), (m) => `<mark>${m}</mark>`),
    escapeHtml(text)
  );

const snippet = (text, term) => {
  const at = text.toLowerCase().indexOf(term);
  const from = Math.max(0, at - 28);
  return `${from > 0 ? '…' : ''}${text.slice(from, at + 80)}…`;
};

// ponytail: substring match over the whole index; switch to a prebuilt inverted index past ~1 MB.
const query = (docs, raw) => {
  const terms = raw.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) {
    return { terms, titles: docs.slice(0, RECENT_COUNT), texts: [] };
  }
  const matches = (value) => terms.every((term) => value.toLowerCase().includes(term));
  const titles = docs.filter((doc) => matches(doc.title));
  const texts = docs
    .filter((doc) => !matches(doc.title) && matches(doc.text))
    .map((doc) => ({ ...doc, hits: doc.text.toLowerCase().split(terms[0]).length - 1 }))
    .sort((a, b) => b.hits - a.hits);
  return { terms, titles, texts };
};

const renderItem = (doc, index, active, terms, withSnippet) => {
  const title = terms.length ? highlight(doc.title, terms) : escapeHtml(doc.title);
  const text = withSnippet
    ? `<span class="search-snippet">${highlight(snippet(doc.text, terms[0]), terms)}</span>`
    : '';
  return `<a class="search-item${index === active ? ' is-active' : ''}" href="${escapeHtml(doc.url)}">
    <span class="search-year aged" style="--age: ${ageOf(doc.date)}">${escapeHtml(doc.date.slice(0, 4))}</span>
    <span class="search-main"><span class="search-title">${title}</span>${text}</span></a>`;
};

const renderResults = ({ terms, titles, texts }, raw, active, copy) => {
  let index = 0;
  const group = (label, docs, withSnippet) =>
    docs.length
      ? `<div class="search-group">${label}</div>${docs
          .map((doc) => renderItem(doc, index++, active, terms, withSnippet))
          .join('')}`
      : '';
  const html = terms.length
    ? group(copy.titles, titles, false) + group(copy.texts, texts, true)
    : group(copy.recent, titles, false);
  return html || `<p class="search-empty-state">${escapeHtml(copy.empty(raw))}</p>`;
};

const buildPanel = (copy) => {
  const panel = document.createElement('div');
  panel.className = 'search-panel';
  panel.hidden = true;
  panel.innerHTML = `<div class="search-dialog" role="dialog" aria-modal="true" aria-label="${copy.label}">
    <label class="search-field">${SEARCH_ICON}<input type="search" placeholder="${escapeHtml(
      copy.placeholder
    )}" autocomplete="off" spellcheck="false" aria-label="${copy.label}" /><kbd>esc</kbd></label>
    <div class="search-results"></div>
    <div class="search-foot"><span>${copy.hints}</span><span data-search-count></span></div></div>`;
  document.body.append(panel);
  return panel;
};

const ui = { trigger: null, panel: null, docs: null, found: [], active: 0, copy: COPY.en };

const render = () => {
  const raw = ui.panel.querySelector('input').value.trim();
  const result = query(ui.docs, raw);
  ui.found = [...result.titles, ...result.texts];
  ui.active = Math.min(ui.active, Math.max(0, ui.found.length - 1));
  ui.panel.querySelector('.search-results').innerHTML = renderResults(
    result,
    raw,
    ui.active,
    ui.copy
  );
  ui.panel.querySelector('[data-search-count]').textContent = raw
    ? ui.copy.count(ui.found.length)
    : '';
  ui.panel.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
};

const close = () => {
  ui.panel.hidden = true;
  document.body.classList.remove('is-searching');
  ui.trigger.focus();
};

const onInputKey = (event) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    ui.active = (ui.active + step + ui.found.length) % Math.max(1, ui.found.length);
    render();
  } else if (event.key === 'Enter' && ui.found[ui.active]) {
    window.location.href = ui.found[ui.active].url;
  } else if (event.key === 'Escape') {
    close();
  }
};

const ensurePanel = () => {
  if (ui.panel) {
    return;
  }
  ui.panel = buildPanel(ui.copy);
  const input = ui.panel.querySelector('input');
  input.addEventListener('input', () => {
    ui.active = 0;
    render();
  });
  input.addEventListener('keydown', onInputKey);
  ui.panel.addEventListener('click', (event) => event.target === ui.panel && close());
};

const open = async () => {
  ensurePanel();
  ui.panel.hidden = false;
  document.body.classList.add('is-searching');
  const input = ui.panel.querySelector('input');
  input.focus();
  input.select();
  try {
    ui.docs ||= (await (await fetch(INDEX_URL)).json()).filter(
      (doc) => doc.lang === state.language
    );
    render();
  } catch {
    ui.panel.querySelector('.search-results').innerHTML =
      `<p class="search-empty-state">${ui.copy.failed}</p>`;
  }
};

const onShortcut = (event) => {
  const typing = event.target.closest?.('input, textarea, [contenteditable]');
  const modK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
  const slash = event.key === '/' && !typing && !event.metaKey && !event.ctrlKey;
  if (modK || slash) {
    event.preventDefault();
    open();
  }
};

export const initSearch = () => {
  ui.trigger = document.querySelector('[data-search-trigger]');
  if (!ui.trigger) {
    return;
  }
  if (!/Mac|iPhone|iPad/.test(navigator.platform)) {
    ui.trigger.querySelector('[data-search-key]').textContent = 'Ctrl K';
  }
  ui.copy = COPY[state.language === 'zh' ? 'zh' : 'en'];
  ui.trigger.addEventListener('click', open);
  document.addEventListener('keydown', onShortcut);
};
