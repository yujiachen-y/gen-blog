// On a fresh visit to the list, the headings on screen soak into the paper; rows wash
// with ink from wherever the pointer enters. The inline <head> script in index.html marks
// the page `ink-pending` before first paint (but not when the reader comes back to it),
// so headings don't flash before they bleed in.
import { pageData } from './state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DURATION = 1500;
const STAGGER = 50;
const MAX_STAGGERED = 8;
const MAX_SCALE = 36;
const MAX_BLUR = 3.5;
const TARGETS = '.year-heading, .card-title';

const createBleedFilter = (defs, seed) => {
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.id = `ink-bleed-${seed}`;
  filter.setAttribute('x', '-15%');
  filter.setAttribute('y', '-60%');
  filter.setAttribute('width', '130%');
  filter.setAttribute('height', '220%');
  filter.innerHTML = `<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="${seed}" /><feDisplacementMap in="SourceGraphic" scale="${MAX_SCALE}" xChannelSelector="R" yChannelSelector="G" /><feGaussianBlur stdDeviation="${MAX_BLUR}" />`;
  defs.append(filter);
  return filter;
};

const bleed = (el, filter, delay) => {
  const displace = filter.querySelector('feDisplacementMap');
  const blur = filter.querySelector('feGaussianBlur');
  el.style.filter = `url(#${filter.id})`;
  el.style.opacity = '0';
  const begin = performance.now() + delay;
  const tick = (now) => {
    const t = Math.min(1, Math.max(0, (now - begin) / DURATION));
    const settle = 1 - (1 - t) ** 3;
    displace.setAttribute('scale', (MAX_SCALE * (1 - settle)).toFixed(2));
    blur.setAttribute('stdDeviation', (MAX_BLUR * (1 - settle)).toFixed(2));
    el.style.opacity = String(Math.min(1, t * 2.4));
    if (t < 1) {
      requestAnimationFrame(tick);
      return;
    }
    el.style.filter = '';
    el.style.opacity = '';
    filter.remove();
  };
  requestAnimationFrame(tick);
};

const isOnScreen = (el) => {
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
};

const trackWashOrigin = (event) => {
  const card = event.target.closest?.('.card');
  if (!card) {
    return;
  }
  const rect = card.getBoundingClientRect();
  card.style.setProperty('--wash-x', `${event.clientX - rect.left}px`);
  card.style.setProperty('--wash-y', `${event.clientY - rect.top}px`);
};

export const initInkBleed = () => {
  document.addEventListener('pointerover', trackWashOrigin);
  const root = document.documentElement;
  const defs = document.querySelector('.ink-defs defs');
  if (pageData.pageType === 'list' && defs && root.classList.contains('ink-pending')) {
    Array.from(document.querySelectorAll(TARGETS))
      .filter(isOnScreen)
      .forEach((el, index) =>
        bleed(el, createBleedFilter(defs, index + 1), Math.min(index, MAX_STAGGERED) * STAGGER)
      );
  }
  root.classList.remove('ink-pending');
};
