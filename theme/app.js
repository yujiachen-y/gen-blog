import { pageData, restoreScrollPosition, saveScrollPosition } from './app/state.js';
import { initFilters } from './app/filters.js';
import { initToc } from './app/toc.js';
import { initComments } from './app/comments.js';
import { initCitation } from './app/citation.js';
import { initThemeControls } from './app/theme.js';
import { initAskAiEntry } from './app/ask-ai-entry.js';
import { initAskAiPage } from './app/ask-ai-page.js';
import { initImagePreview } from './app/image-preview.js';

const markTallImages = () => {
  if (pageData.pageType !== 'post') {
    return;
  }
  const images = Array.from(document.querySelectorAll('.article-body img'));
  if (!images.length) {
    return;
  }
  const tallRatio = 1.35;
  const apply = (img) => {
    const { naturalWidth, naturalHeight } = img;
    if (!naturalWidth || !naturalHeight) {
      return;
    }
    const ratio = naturalHeight / naturalWidth;
    img.classList.toggle('is-tall', ratio >= tallRatio);
  };
  images.forEach((img) => {
    if (img.complete) {
      apply(img);
    } else {
      img.addEventListener('load', () => apply(img), { once: true });
    }
  });
};

const init = async () => {
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
