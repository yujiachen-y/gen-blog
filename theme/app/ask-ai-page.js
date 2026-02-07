import { pageData } from './state.js';
import { buildPrompt, resolveUiLanguage } from './ask-ai-prompt.js';
import { bindCopyPrompt, bindProviders, openChatGpt } from './ask-ai-page-actions.js';
import { buildPromptWithQuestion, normalizeQuestion, uiText } from './ask-ai-page-config.js';

const setText = (root, selector, value) => {
  const node = root.querySelector(selector);
  if (!node) {
    return;
  }
  node.textContent = value;
};

const setAttribute = (root, selector, attribute, value) => {
  const node = root.querySelector(selector);
  if (!node) {
    return;
  }
  node.setAttribute(attribute, value);
};

const resolveSubtitle = (text, params) => {
  const fromPost = params.get('from') === 'post';
  const postTitle = fromPost ? (params.get('title') || '').trim() : '';
  return postTitle ? text.subtitlePost.replace('%TITLE%', postTitle) : text.subtitle;
};

const applyUiText = (root, text, params) => {
  setText(root, '[data-ask-ai-kicker]', text.kicker);
  setText(root, '[data-ask-ai-title]', text.title);
  setText(root, '[data-ask-ai-subtitle]', resolveSubtitle(text, params));
  setText(root, '[data-ask-ai-trust]', text.trust);
  setAttribute(root, '[data-ask-ai-query]', 'placeholder', text.placeholder);
  setText(root, '[data-ask-ai-submit]', text.ask);
  setText(root, '[data-provider-note]', text.providerNote);
  setText(root, '[data-provider-link-label]', text.providerLink);
  setText(root, '[data-separator-label]', text.separator);
  setText(root, '[data-prompt-title]', text.promptTitle);
  setText(root, '[data-prompt-description]', text.promptDescription);
  setText(root, '[data-copy-prompt]', text.copy);

  Array.from(root.querySelectorAll('[data-ask-ai-chip]')).forEach((chipButton, index) => {
    chipButton.textContent = text.chips[index] || chipButton.textContent;
  });
};

const bindPromptToggle = (root, text) => {
  const section = root.querySelector('[data-prompt-section]');
  const summaryButton = root.querySelector('[data-toggle-prompt-summary]');
  const toggleButton = root.querySelector('[data-toggle-prompt]');
  const toggleLabel = root.querySelector('[data-toggle-prompt-label]');
  const content = root.querySelector('[data-prompt-content]');
  if (!section || !toggleButton || !toggleLabel || !content) {
    return;
  }

  const syncState = () => {
    const expanded = !section.classList.contains('is-collapsed');
    toggleLabel.textContent = text.promptPanel;
    if (summaryButton) {
      summaryButton.setAttribute('aria-label', text.promptPanel);
      summaryButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
    toggleButton.setAttribute('aria-label', text.promptPanel);
    toggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    content.hidden = !expanded;
  };

  const toggleSection = () => {
    section.classList.toggle('is-collapsed');
    syncState();
  };

  if (summaryButton) {
    summaryButton.addEventListener('click', toggleSection);
  }
  toggleButton.addEventListener('click', toggleSection);

  syncState();
};

const createPromptController = (root, basePrompt, language, initialQuestion) => {
  const promptOutput = root.querySelector('[data-prompt-output]');
  let activePrompt = '';

  const setQuestion = (question) => {
    activePrompt = buildPromptWithQuestion({ basePrompt, question, language });
    if (promptOutput) {
      promptOutput.textContent = activePrompt;
    }
    return activePrompt;
  };

  setQuestion(initialQuestion);

  return {
    getPrompt: () => activePrompt,
    setQuestion,
  };
};

const bindAskForm = (root, params, promptController, refreshProviders) => {
  const form = root.querySelector('[data-ask-ai-form]');
  const queryInput = root.querySelector('[data-ask-ai-query]');
  const chipButtons = Array.from(root.querySelectorAll('[data-ask-ai-chip]'));
  if (!queryInput) {
    return;
  }

  const submitQuestion = (value) => {
    const nextPrompt = promptController.setQuestion(value);
    refreshProviders();
    openChatGpt(nextPrompt);
  };

  const initialQuestion = normalizeQuestion(params.get('q'));
  if (initialQuestion) {
    queryInput.value = initialQuestion;
    promptController.setQuestion(initialQuestion);
    refreshProviders();
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitQuestion(queryInput.value);
    });
  }

  queryInput.addEventListener('input', () => {
    promptController.setQuestion(queryInput.value);
    refreshProviders();
  });

  chipButtons.forEach((chipButton) => {
    chipButton.addEventListener('click', () => {
      const chipQuestion = normalizeQuestion(chipButton.textContent);
      queryInput.value = chipQuestion;
      submitQuestion(chipQuestion);
    });
  });
};

export const initAskAiPage = () => {
  const root = document.querySelector('[data-ask-ai-page]');
  if (!root || pageData.pageType !== 'ask-ai') {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const language = resolveUiLanguage({
    params,
    fallbackLang: pageData.lang,
    documentLang: document.documentElement.getAttribute('lang'),
  });
  const text = uiText[language] || uiText.en;
  const basePrompt = buildPrompt({ params, language, fallbackLang: pageData.lang });
  const promptController = createPromptController(root, basePrompt, language, '');

  applyUiText(root, text, params);
  bindPromptToggle(root, text);
  bindCopyPrompt(root, promptController.getPrompt, text);
  const { refreshPrefillProviders } = bindProviders(root, promptController.getPrompt, text);
  bindAskForm(root, params, promptController, refreshPrefillProviders);
};
