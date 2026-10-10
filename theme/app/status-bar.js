// A corner status line, like the word count an editor keeps in its status bar.
import { pageData } from './state.js';
import { formatWords } from './reading.js';
import { onScrollFrame } from './frame.js';

const LIST_HINTS = {
  zh: 'j / k 选择 · ↵ 打开 · / 搜索',
  en: 'j / k select · ↵ open · / search',
};

const trackProgress = (bar, body, words) =>
  onScrollFrame(() => {
    const rect = body.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const ratio = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
    bar.textContent = `${words} · ${Math.round(ratio * 100)}%`;
  });

export const initStatusBar = () => {
  const lang = pageData.lang === 'zh' ? 'zh' : 'en';
  const body = document.querySelector('.article-body');
  if (pageData.pageType !== 'list' && !(pageData.pageType === 'post' && body)) {
    return;
  }
  const bar = document.createElement('div');
  bar.className = 'status-bar';
  bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);
  if (pageData.pageType === 'list') {
    bar.textContent = LIST_HINTS[lang];
    return;
  }
  trackProgress(bar, body, formatWords(pageData.wordCount, lang));
};
