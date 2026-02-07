import { pageData } from './state.js';

const PREVIEW_IMAGE_SELECTOR = '.article-body img, .article-cover img';

const isPreviewEnabledPage = () => pageData.pageType === 'post' || pageData.pageType === 'about';

const buildModal = () => {
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
  modal.append(closeButton, frame);
  document.body.appendChild(modal);

  return { modal, closeButton, image, caption };
};

const getImageLabel = (image) => {
  const alt = String(image.getAttribute('alt') || '').trim();
  return alt || 'Open image preview';
};

const bindPreviewTrigger = (image, openPreview) => {
  image.classList.add('is-previewable');
  image.setAttribute('tabindex', '0');
  image.setAttribute('role', 'button');
  image.setAttribute('aria-label', getImageLabel(image));

  image.addEventListener('click', (event) => {
    event.preventDefault();
    openPreview(image);
  });

  image.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    openPreview(image);
  });
};

const renderCaption = (caption, alt) => {
  if (!alt) {
    caption.textContent = '';
    caption.hidden = true;
    return;
  }
  caption.textContent = alt;
  caption.hidden = false;
};

export const initImagePreview = () => {
  if (!isPreviewEnabledPage()) {
    return;
  }

  const images = Array.from(document.querySelectorAll(PREVIEW_IMAGE_SELECTOR));
  if (images.length === 0) {
    return;
  }

  const { modal, closeButton, image: previewImage, caption } = buildModal();
  let activeTrigger = null;

  const closePreview = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    modal.hidden = true;
    document.body.classList.remove('image-preview-open');
    previewImage.removeAttribute('src');
    previewImage.alt = '';
    if (activeTrigger) {
      activeTrigger.focus();
      activeTrigger = null;
    }
  };

  const openPreview = (image) => {
    const src = image.currentSrc || image.src;
    if (!src) {
      return;
    }
    activeTrigger = image;
    previewImage.src = src;
    const alt = String(image.getAttribute('alt') || '').trim();
    previewImage.alt = alt;
    renderCaption(caption, alt);
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    document.body.classList.add('image-preview-open');
    closeButton.focus();
  };

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closePreview();
    }
  });

  closeButton.addEventListener('click', () => {
    closePreview();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closePreview();
    }
  });

  images.forEach((image) => bindPreviewTrigger(image, openPreview));
};
