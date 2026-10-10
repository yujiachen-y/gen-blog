import { pageData } from './state.js';
import { onScrollFrame } from './frame.js';

// Long outlines scroll inside the sticky sidebar; keep the inked item in view.
const keepVisible = (scroller, item) => {
  const top = item.offsetTop;
  const bottom = top + item.offsetHeight;
  if (scroller.scrollHeight <= scroller.clientHeight) {
    return;
  }
  if (top < scroller.scrollTop || bottom > scroller.scrollTop + scroller.clientHeight) {
    scroller.scrollTop = top - scroller.clientHeight / 3;
  }
};

// Inks the outline entry of the section being read.
const trackActive = (toc) => {
  const entries = Array.from(toc.querySelectorAll('.toc-item a'))
    .map((link) => ({
      item: link.parentElement,
      heading: document.getElementById(decodeURIComponent(link.hash.slice(1))),
    }))
    .filter((entry) => entry.heading);
  let current = null;
  if (!entries.length) {
    return;
  }
  onScrollFrame(() => {
    const line = window.innerHeight * 0.3;
    const next =
      entries.filter((entry) => entry.heading.getBoundingClientRect().top <= line).pop() ||
      entries[0];
    if (next === current) {
      return;
    }
    current?.item.classList.remove('is-active');
    next.item.classList.add('is-active');
    current = next;
    keepVisible(toc, next.item);
  });
};

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
  trackActive(toc);
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
