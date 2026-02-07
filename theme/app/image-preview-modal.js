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
  const icon = document.createElement('span');
  icon.className = 'image-preview-nav-icon';
  icon.textContent = symbol;
  button.append(icon);
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

const createGhostImage = (src) => {
  const ghost = document.createElement('img');
  ghost.src = src;
  ghost.alt = '';
  ghost.className = 'image-preview-ghost';
  return ghost;
};

const animateGhostBetweenRects = async ({ ghost, fromRect, toRect, fromRadius, toRadius }) => {
  const animation = ghost.animate(
    [
      {
        top: `${fromRect.top}px`,
        left: `${fromRect.left}px`,
        width: `${fromRect.width}px`,
        height: `${fromRect.height}px`,
        borderRadius: fromRadius,
      },
      {
        top: `${toRect.top}px`,
        left: `${toRect.left}px`,
        width: `${toRect.width}px`,
        height: `${toRect.height}px`,
        borderRadius: toRadius,
      },
    ],
    {
      duration: PREVIEW_OPEN_DURATION_MS,
      easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      fill: 'forwards',
    }
  );
  await animation.finished.catch(() => null);
};

const runGhostTransition = async ({
  previewImage,
  src,
  fromRect,
  toRect,
  fromRadius,
  toRadius,
}) => {
  const ghost = createGhostImage(src);
  setGhostLayout({ ghost, rect: fromRect, borderRadius: fromRadius });

  previewImage.classList.add('is-hidden-during-open');
  document.body.appendChild(ghost);
  await animateGhostBetweenRects({
    ghost,
    fromRect,
    toRect,
    fromRadius,
    toRadius,
  });
  ghost.remove();
  previewImage.classList.remove('is-hidden-during-open');
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

  const sourceRadius = window.getComputedStyle(sourceImage).borderRadius || '6px';
  const targetRadius = window.getComputedStyle(previewImage).borderRadius || '10px';
  await runGhostTransition({
    previewImage,
    src,
    fromRect: sourceRect,
    toRect: targetRect,
    fromRadius: sourceRadius,
    toRadius: targetRadius,
  });
};

const canAnimateCloseTarget = (targetRect) =>
  targetRect.width > 0 &&
  targetRect.height > 0 &&
  targetRect.bottom >= 0 &&
  targetRect.top <= window.innerHeight &&
  targetRect.right >= 0 &&
  targetRect.left <= window.innerWidth;

const resolveCloseAnimationContext = async ({ sourceImage, previewImage }) => {
  if (!sourceImage || (reduceMotionQuery && reduceMotionQuery.matches)) {
    return null;
  }

  const src = previewImage.currentSrc || previewImage.getAttribute('src') || '';
  if (!src) {
    return null;
  }

  await waitForImageReady(previewImage);
  await nextFrame();
  const fromRect = previewImage.getBoundingClientRect();
  const toRect = sourceImage.getBoundingClientRect();
  if (!fromRect.width || !fromRect.height || !canAnimateCloseTarget(toRect)) {
    return null;
  }
  return { src, fromRect, toRect };
};

const runCloseAnimation = async ({ sourceImage, previewImage, context }) => {
  const { src, fromRect, toRect } = context;

  const fromRadius = window.getComputedStyle(previewImage).borderRadius || '10px';
  const toRadius = window.getComputedStyle(sourceImage).borderRadius || '6px';
  await runGhostTransition({
    previewImage,
    src,
    fromRect,
    toRect,
    fromRadius,
    toRadius,
  });
};

export const animateCloseToSource = async ({ sourceImage, previewImage }) => {
  const context = await resolveCloseAnimationContext({ sourceImage, previewImage });
  if (!context) {
    return false;
  }
  await runCloseAnimation({ sourceImage, previewImage, context });
  return true;
};
