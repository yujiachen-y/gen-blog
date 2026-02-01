import { pageData } from './state.js';

export const initToc = () => {
  if (pageData.pageType !== 'post' && pageData.pageType !== 'about') {
    return;
  }
  const toc = document.querySelector('[data-toc]');
  if (!toc) {
    return;
  }
  const toggle = toc.querySelector('[data-toc-toggle]');
  const panel = toc.querySelector('[data-toc-panel]');
  if (!toggle || !panel) {
    return;
  }
  const setOpen = (isOpen) => {
    toc.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  };
  const isMobile = window.matchMedia('(max-width: 1439px)').matches;
  setOpen(!isMobile);
  toggle.addEventListener('click', () => {
    setOpen(!toc.classList.contains('is-open'));
  });
  panel.addEventListener('click', (event) => {
    if (!window.matchMedia('(max-width: 1439px)').matches) {
      return;
    }
    if (event.target instanceof HTMLAnchorElement) {
      setOpen(false);
    }
  });
};
