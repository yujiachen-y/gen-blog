// List keys: j / k walk the posts, Enter opens the focused one. / belongs to search.js.
import { pageData } from './state.js';

const moveFocus = (delta) => {
  const cards = Array.from(document.querySelectorAll('#grid-container .card'));
  if (!cards.length) {
    return;
  }
  const current = cards.indexOf(document.activeElement);
  const next = current === -1 ? 0 : Math.min(cards.length - 1, Math.max(0, current + delta));
  cards[next].focus({ preventScroll: true });
  cards[next].scrollIntoView({ block: 'center' });
};

const ACTIONS = {
  j: () => moveFocus(1),
  k: () => moveFocus(-1),
};

export const initKeys = () => {
  if (pageData.pageType !== 'list') {
    return;
  }
  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (event.target.closest?.('input, textarea, [contenteditable]')) {
      if (event.key === 'Escape') {
        event.target.blur();
      }
      return;
    }
    const action = ACTIONS[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  });
};
