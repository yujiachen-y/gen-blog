import { pageData, restoreScrollPosition, saveScrollPosition } from './app/state.js';
import { initFilters } from './app/filters.js';
import { initToc } from './app/toc.js';
import { initComments } from './app/comments.js';
import { initThemeControls } from './app/theme.js';
import { initAskAiEntry } from './app/ask-ai-entry.js';
import { initAskAiPage } from './app/ask-ai-page.js';

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

const updateActiveNav = () => {
  const navLinks = document.querySelectorAll('.nav-link-button');
  navLinks.forEach((link) => {
    let isActive = false;
    const navType = link.dataset.nav;
    if (pageData.pageType === 'about' && navType === 'about') {
      isActive = true;
    } else if (
      (pageData.pageType === 'list' || pageData.pageType === 'post') &&
      navType === 'blog'
    ) {
      isActive = true;
    }

    // Fallback: Check strictly by URL if pageType logic didn't match (e.g. unknown pages)
    if (!isActive) {
      try {
        const linkPath = new URL(link.href, window.location.origin).pathname;
        if (window.location.pathname === linkPath) {
          isActive = true;
        }
      } catch (e) {
        // ignore
      }
    }

    link.classList.toggle('active', isActive);
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
  updateActiveNav();
  initComments();
  window.addEventListener('beforeunload', saveScrollPosition);
};

init();
