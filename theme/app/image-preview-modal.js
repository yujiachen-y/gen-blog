const PREVIEW_OPEN_DURATION_MS = 260;
const reduceMotionQuery =
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(resolve));

const waitForImageReady = (image) => {
  if (image.complete) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => resolve();
    image.addEventListener('load', done, { once: true });
    image.addEventListener('error', done, { once: true });
  });
};

const createNavButton = ({ className, label, symbol }) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.textContent = symbol;
  return button;
};

export const buildModal = () => {
  const modal = document.createElement('div');
  modal.className = 'image-preview-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Image preview');
  modal.setAttribute('aria-hidden', 'true');
  modal.hidden = true;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'image-preview-close';
  closeButton.setAttribute('aria-label', 'Close image preview');
  closeButton.textContent = '×';

  const prevButton = createNavButton({
    className: 'image-preview-nav image-preview-nav-prev',
    label: 'Previous image',
    symbol: '‹',
  });
  const nextButton = createNavButton({
    className: 'image-preview-nav image-preview-nav-next',
    label: 'Next image',
    symbol: '›',
  });

  const frame = document.createElement('div');
  frame.className = 'image-preview-frame';

  const image = document.createElement('img');
  image.className = 'image-preview-image';
  image.alt = '';

  const caption = document.createElement('div');
  caption.className = 'image-preview-caption';
  caption.id = 'image-preview-caption';
  caption.hidden = true;

  frame.append(image, caption);
  modal.append(closeButton, prevButton, nextButton, frame);
  document.body.appendChild(modal);

  return { modal, closeButton, prevButton, nextButton, image, caption };
};

const setGhostLayout = ({ ghost, rect, borderRadius }) => {
  Object.assign(ghost.style, {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius,
  });
};

export const animateOpenFromSource = async ({ sourceImage, previewImage, src }) => {
  if (reduceMotionQuery && reduceMotionQuery.matches) {
    return;
  }

  const sourceRect = sourceImage.getBoundingClientRect();
  if (!sourceRect.width || !sourceRect.height) {
    return;
  }

  await waitForImageReady(previewImage);
  await nextFrame();
  const targetRect = previewImage.getBoundingClientRect();
  if (!targetRect.width || !targetRect.height) {
    return;
  }

  const ghost = document.createElement('img');
  ghost.src = src;
  ghost.alt = '';
  ghost.className = 'image-preview-ghost';
  const sourceRadius = window.getComputedStyle(sourceImage).borderRadius || '6px';
  const targetRadius = window.getComputedStyle(previewImage).borderRadius || '10px';
  setGhostLayout({ ghost, rect: sourceRect, borderRadius: sourceRadius });

  previewImage.classList.add('is-hidden-during-open');
  document.body.appendChild(ghost);
  const animation = ghost.animate(
    [
      {
        top: `${sourceRect.top}px`,
        left: `${sourceRect.left}px`,
        width: `${sourceRect.width}px`,
        height: `${sourceRect.height}px`,
        borderRadius: sourceRadius,
      },
      {
        top: `${targetRect.top}px`,
        left: `${targetRect.left}px`,
        width: `${targetRect.width}px`,
        height: `${targetRect.height}px`,
        borderRadius: targetRadius,
      },
    ],
    {
      duration: PREVIEW_OPEN_DURATION_MS,
      easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      fill: 'forwards',
    }
  );
  await animation.finished.catch(() => null);
  ghost.remove();
  previewImage.classList.remove('is-hidden-during-open');
};
