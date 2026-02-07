import { pageData } from './state.js';
import { animateCloseToSource, animateOpenFromSource, buildModal } from './image-preview-modal.js';

const PREVIEW_IMAGE_SELECTOR = '.article-body img, .article-cover img';

const isPreviewEnabledPage = () => pageData.pageType === 'post' || pageData.pageType === 'about';

const resolveImageSrc = (image) => image.currentSrc || image.getAttribute('src') || '';

const getImageAlt = (image) => String(image.getAttribute('alt') || '').trim();

const getImageLabel = (image) => getImageAlt(image) || 'Open image preview';

const renderCaption = (caption, alt) => {
  if (alt) {
    caption.textContent = alt;
    caption.hidden = false;
    return;
  }
  caption.textContent = '';
  caption.hidden = true;
};

const bindPreviewTrigger = ({ image, openPreview }) => {
  image.classList.add('is-previewable');
  image.setAttribute('tabindex', '0');
  image.setAttribute('role', 'button');
  image.setAttribute('aria-label', getImageLabel(image));

  image.addEventListener('click', (event) => {
    event.preventDefault();
    void openPreview(image);
  });

  image.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    void openPreview(image);
  });
};

const createPreviewState = ({ images, modalRefs }) => ({
  ...modalRefs,
  images,
  imageIndexMap: new Map(images.map((image, index) => [image, index])),
  activeIndex: -1,
  activeTrigger: null,
  isClosing: false,
});

const updateNavState = (state) => {
  const hasMultiple = state.images.length > 1;
  state.prevButton.hidden = !hasMultiple;
  state.nextButton.hidden = !hasMultiple;
  state.prevButton.disabled = !hasMultiple || state.activeIndex <= 0;
  state.nextButton.disabled = !hasMultiple || state.activeIndex >= state.images.length - 1;
};

const setPreviewContent = ({ state, image }) => {
  const src = resolveImageSrc(image);
  if (!src) {
    return null;
  }

  state.previewImage.src = src;
  const alt = getImageAlt(image);
  state.previewImage.alt = alt;
  renderCaption(state.caption, alt);
  return src;
};

const showImageAt = async ({ state, index, animateFrom }) => {
  if (index < 0 || index >= state.images.length) {
    return;
  }
  const image = state.images[index];
  const src = setPreviewContent({ state, image });
  if (!src) {
    return;
  }

  state.activeIndex = index;
  state.activeTrigger = image;
  updateNavState(state);

  if (animateFrom) {
    await animateOpenFromSource({
      sourceImage: animateFrom,
      previewImage: state.previewImage,
      src,
    });
  }
};

const finalizeClose = (state) => {
  state.modal.classList.remove('is-open');
  state.modal.classList.remove('is-closing');
  state.modal.setAttribute('aria-hidden', 'true');
  state.modal.hidden = true;
  document.body.classList.remove('image-preview-open');
  state.previewImage.removeAttribute('src');
  state.previewImage.alt = '';
  state.activeIndex = -1;

  if (state.activeTrigger) {
    state.activeTrigger.focus();
    state.activeTrigger = null;
  }
};

const closePreview = async (state) => {
  if (state.isClosing || !state.modal.classList.contains('is-open')) {
    return;
  }
  state.isClosing = true;
  state.modal.classList.add('is-closing');
  await animateCloseToSource({
    sourceImage: state.activeTrigger,
    previewImage: state.previewImage,
  });
  finalizeClose(state);
  state.isClosing = false;
};

const openPreview = async ({ state, image }) => {
  if (state.isClosing) {
    return;
  }
  const index = state.imageIndexMap.get(image);
  if (typeof index !== 'number') {
    return;
  }

  state.modal.hidden = false;
  state.modal.setAttribute('aria-hidden', 'false');
  state.modal.classList.add('is-open');
  document.body.classList.add('image-preview-open');
  await showImageAt({ state, index, animateFrom: image });
  state.closeButton.focus();
};

const showPrevious = (state) => {
  if (state.activeIndex > 0) {
    void showImageAt({ state, index: state.activeIndex - 1 });
  }
};

const showNext = (state) => {
  if (state.activeIndex < state.images.length - 1) {
    void showImageAt({ state, index: state.activeIndex + 1 });
  }
};

const shouldCloseByClick = (event) => {
  if (!(event.target instanceof Element)) {
    return false;
  }
  return !event.target.closest('.image-preview-image, .image-preview-nav, .image-preview-close');
};

const bindModalEvents = (state) => {
  state.modal.addEventListener('click', (event) => {
    if (shouldCloseByClick(event)) {
      void closePreview(state);
    }
  });
  state.closeButton.addEventListener('click', () => void closePreview(state));
  state.prevButton.addEventListener('click', () => showPrevious(state));
  state.nextButton.addEventListener('click', () => showNext(state));
};

const handleKeyboard = ({ state, event }) => {
  if (!state.modal.classList.contains('is-open')) {
    return;
  }

  if (event.key === 'Escape') {
    void closePreview(state);
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    showPrevious(state);
    return;
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    showNext(state);
  }
};

const bindDocumentEvents = (state) => {
  document.addEventListener('keydown', (event) => {
    handleKeyboard({ state, event });
  });
};

export const initImagePreview = () => {
  if (!isPreviewEnabledPage()) {
    return;
  }

  const images = Array.from(document.querySelectorAll(PREVIEW_IMAGE_SELECTOR));
  if (images.length === 0) {
    return;
  }

  const modalRefs = buildModal();
  const state = createPreviewState({
    images,
    modalRefs: {
      modal: modalRefs.modal,
      closeButton: modalRefs.closeButton,
      prevButton: modalRefs.prevButton,
      nextButton: modalRefs.nextButton,
      previewImage: modalRefs.image,
      caption: modalRefs.caption,
    },
  });

  bindModalEvents(state);
  bindDocumentEvents(state);
  updateNavState(state);
  images.forEach((image) =>
    bindPreviewTrigger({
      image,
      openPreview: (currentImage) => openPreview({ state, image: currentImage }),
    })
  );
};
