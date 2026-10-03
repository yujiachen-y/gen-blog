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
  initThemeControls();
  initAskAiEntry();
  initAskAiPage();
  await initFilters();
  restoreScrollPosition();
  initToc();
  markTallImages();
  initImagePreview();
  initCitation();
  initComments();
  window.addEventListener('beforeunload', saveScrollPosition);
};

init();
