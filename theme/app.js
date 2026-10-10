import { pageData, restoreScrollPosition, saveScrollPosition } from './app/state.js';
import { initFilters } from './app/filters.js';
import { initToc } from './app/toc.js';
import { initComments } from './app/comments.js';
import { initCitation } from './app/citation.js';
import { initThemeControls } from './app/theme.js';
import { initAskAiEntry } from './app/ask-ai-entry.js';
import { initAskAiPage } from './app/ask-ai-page.js';
import { initImagePreview } from './app/image-preview.js';
import { initNavMobile } from './app/nav-mobile.js';
import { initStatusBar } from './app/status-bar.js';
import { initKeys } from './app/keys.js';
import { initSearch } from './app/search.js';
import { initInkBleed } from './app/ink-bleed.js';
import { initInkWell } from './app/ink-well.js';

const markTallImages = () => {
  if (pageData.pageType !== 'post') {
    return;
  }
  const images = Array.from(document.querySelectorAll('.article-body img'));
  if (!images.length) {
    return;
  }
  const tallRatio = 1.35;
  // Width/height attributes let lazy images get their class before they load,
  // so they don't shift layout when scrolled into view.
  const apply = (img) => {
    const width = img.naturalWidth || Number(img.getAttribute('width'));
    const height = img.naturalHeight || Number(img.getAttribute('height'));
    if (!width || !height) {
      return;
    }
    img.classList.toggle('is-tall', height / width >= tallRatio);
  };
  images.forEach((img) => {
    apply(img);
    if (!img.complete) {
      img.addEventListener('load', () => apply(img), { once: true });
    }
  });
};

const init = async () => {
  initNavMobile();
  initSearch();
  initThemeControls();
  initAskAiEntry();
  initAskAiPage();
  // Restore before the ink lands so it lands on what's on screen, and never make the
  // list wait for the filter index; restore again if a saved filter re-rendered it.
  restoreScrollPosition();
  initInkBleed();
  await initFilters();
  restoreScrollPosition();
  initKeys();
  initStatusBar();
  initToc();
  markTallImages();
  initImagePreview();
  initCitation();
  initComments();
  // Decorative and last, so nothing above depends on it.
  initInkWell();
  // pagehide (unlike beforeunload) keeps the page eligible for the back/forward cache.
  window.addEventListener('pagehide', saveScrollPosition);
};

init();
