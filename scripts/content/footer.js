// The site footer: the name pressed into the last of the paper, the corners of the page
// to turn (posts only), then an ink well holding the invitation, links and colophon.
// The well's ripples live in theme/app/ink-well.js.
import { escapeHtml } from '../shared/templates.js';
import { buildSocialLinksHtml } from './pages.js';
import { ageOf } from '../../theme/app/age.js';

const REPO_URL = 'https://github.com/yujiachen-y/gen-blog';

const COPY = {
  zh: {
    invite: '写博客，是为了遇见新朋友。',
    newer: '上一页',
    older: '下一页',
    stats: (posts, words, years) => `${posts} 篇 · ${words} · ${years}`,
    words: (n) => (n >= 10000 ? `${(n / 10000).toFixed(1)} 万字` : `${n} 字`),
    made: `用 Obsidian 写成，由 <a href="${REPO_URL}">gen-blog</a> 排印`,
  },
  en: {
    invite: 'I write to meet new friends.',
    newer: 'Previous',
    older: 'Next',
    stats: (posts, words, years) => `${posts} posts · ${words} · ${years}`,
    words: (n) => (n >= 1000 ? `${Math.round(n / 1000)}k words` : `${n} words`),
    made: `Written in Obsidian, set by <a href="${REPO_URL}">gen-blog</a>`,
  },
};

// Where the paper meets the ink: an uneven, slightly soft edge drawn as part of the well.
const WET_EDGE =
  '<svg class="ink-well-edge" viewBox="0 0 1440 56" preserveAspectRatio="none" aria-hidden="true" focusable="false"><filter id="ink-well-soft"><feGaussianBlur stdDeviation="0.9" /></filter><path filter="url(#ink-well-soft)" d="M0,31 C40,29 70,34 118,32 C170,30 196,24 246,25 C300,26 318,35 372,34 C420,33 452,27 506,26 C566,25 590,18 648,20 C700,22 728,31 786,33 C838,35 874,29 930,27 C986,25 1010,33 1068,32 C1124,31 1150,22 1208,21 C1262,20 1296,28 1348,27 C1390,26 1414,23 1440,24 L1440,80 L0,80 Z" /></svg>';

const buildNameHtml = (siteTitle) =>
  Array.from(siteTitle)
    .map((char) => (char === ' ' ? ' ' : `<span>${escapeHtml(char)}</span>`))
    .join('');

// A turned-up corner showing the neighbouring post on its own (older or newer) paper.
const buildCurlHtml = (post, side, label) => {
  if (!post) {
    return '';
  }
  const arrow = side === 'newer' ? `← ${label}` : `${label} →`;
  return `
    <a class="page-curl page-curl-${side}" href="${escapeHtml(post.url)}" style="--next-age: ${ageOf(
      post.date
    )}" aria-label="${escapeHtml(`${label}: ${post.title}`)}">
      <span class="page-curl-under"><i>${escapeHtml(arrow)}</i><b>${escapeHtml(
        post.title
      )}</b><small>${escapeHtml(post.date.slice(0, 4))}</small></span>
      <span class="page-curl-flap"></span>
    </a>`;
};

const buildStats = (items, copy) => {
  const words = items.reduce((sum, item) => sum + (item.wordCount || 0), 0);
  const years = items.map((item) => item.date.slice(0, 4)).sort();
  const span = years.length ? `${years[0]}–${years.at(-1)}` : '';
  return copy.stats(items.length, copy.words(words), span);
};

export const buildFooterHtml = ({
  lang,
  items = [],
  social = [],
  siteTitle = '',
  newer,
  older,
}) => {
  const copy = COPY[lang] || COPY.en;
  const curls =
    buildCurlHtml(newer, 'newer', copy.newer) + buildCurlHtml(older, 'older', copy.older);
  return `
<footer class="site-footer">
  <div class="footer-paper${curls ? ' has-curls' : ''}">
    <p class="footer-name" aria-hidden="true">${buildNameHtml(siteTitle)}</p>${curls}
  </div>
  <div class="ink-well" data-ink-well>
    ${WET_EDGE}
    <canvas class="ink-well-water" aria-hidden="true"></canvas>
    <div class="ink-well-inner">
      <p class="ink-well-invite">${escapeHtml(copy.invite)}</p>
      <ul class="about-social-list ink-well-links">${buildSocialLinksHtml(social)}
      </ul>
      <p class="ink-well-colophon">
        <span>${escapeHtml(buildStats(items, copy))}</span>
        <span>${copy.made}</span>
        <span>© ${new Date().getFullYear()} ${escapeHtml(siteTitle)}</span>
      </p>
    </div>
  </div>
</footer>`;
};

// Posts get their neighbours in the list (newer and older); other pages get no corners.
export const createFooterBuilder = ({ listDataByLang, social, siteTitle }) => {
  const itemsByLang = new Map(listDataByLang.map((group) => [group.lang, group.items]));
  return (lang, url = null) => {
    const items = itemsByLang.get(lang) || [];
    const at = url ? items.findIndex((item) => item.url === url) : -1;
    return buildFooterHtml({
      lang,
      items,
      social,
      siteTitle,
      newer: at > 0 ? items[at - 1] : null,
      older: at >= 0 ? items[at + 1] || null : null,
    });
  };
};
