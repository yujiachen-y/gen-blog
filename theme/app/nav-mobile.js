import { pageData } from './state.js';

const navbarSelector = '[data-navbar]';
const toggleSelector = '[data-nav-mobile-toggle]';
const sheetSelector = '[data-nav-mobile-sheet]';
const linkSelector = '[data-nav-mobile]';
const scrollThreshold = 4;

const setOpen = (toggle, sheet, isOpen) => {
  toggle.setAttribute('aria-expanded', String(isOpen));
  toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  if (isOpen) {
    sheet.removeAttribute('hidden');
    requestAnimationFrame(() => sheet.classList.add('is-open'));
    document.documentElement.style.overflow = 'hidden';
  } else {
    sheet.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    window.setTimeout(() => {
      if (toggle.getAttribute('aria-expanded') === 'false') {
        sheet.setAttribute('hidden', '');
      }
    }, 240);
  }
};

const markActiveMobileLinks = () => {
  const pageType = pageData.pageType;
  if (!pageType) return;
  const map = { list: 'blog', post: 'blog', about: 'about', 'ask-ai': 'ask-ai' };
  const active = map[pageType];
  if (!active) return;
  document.querySelectorAll(linkSelector).forEach((link) => {
    if (link.dataset.navMobile === active) {
      link.classList.add('is-active');
    }
  });
};

const initStickyNav = () => {
  const navbar = document.querySelector(navbarSelector);
  if (!navbar) return;
  const update = () => {
    const scrolled = (window.scrollY || window.pageYOffset || 0) > scrollThreshold;
    navbar.classList.toggle('is-scrolled', scrolled);
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
};

export const initNavMobile = () => {
  initStickyNav();
  markActiveMobileLinks();
  const toggle = document.querySelector(toggleSelector);
  const sheet = document.querySelector(sheetSelector);
  if (!toggle || !sheet) return;
  setOpen(toggle, sheet, false);
  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    setOpen(toggle, sheet, !isOpen);
  });
  sheet.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLAnchorElement) {
      setOpen(toggle, sheet, false);
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(toggle, sheet, false);
      toggle.focus();
    }
  });
  const wide = window.matchMedia('(min-width: 721px)');
  const onChange = (event) => {
    if (event.matches) {
      setOpen(toggle, sheet, false);
    }
  };
  if (typeof wide.addEventListener === 'function') {
    wide.addEventListener('change', onChange);
  } else if (typeof wide.addListener === 'function') {
    wide.addListener(onChange);
  }
};
