import { pageData } from './state.js';
import { buildPrompt, resolveUiLanguage } from './ask-ai-prompt.js';

const uiText = {
  en: {
    kicker: 'ASK AI',
    title: 'Ask anything about me.',
    subtitle: 'Start a conversation with your favorite LLM, powered by context from my blog.',
    viewPrompt: 'View prompt',
    hidePrompt: 'Hide prompt',
    copy: 'Copy',
    copySuccess: 'Copied prompt.',
    copyFailure: 'Copy failed. Please copy manually.',
    copiedRedirect: 'Copied! Opening',
  },
  zh: {
    kicker: 'ASK AI',
    title: '让 AI 替你翻翻我的博客。',
    subtitle: '挑一个你顺手的 LLM，带上这里的上下文，随便聊。',
    viewPrompt: '看看 Prompt 写了啥',
    hidePrompt: '收起 Prompt',
    copy: '复制',
    copySuccess: '已复制，去粘贴吧。',
    copyFailure: '复制失败，请手动复制。',
    copiedRedirect: '已复制！正在打开',
  },
};

const providers = {
  chatgpt: {
    url: (prompt) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
    prefill: true,
  },
  claude: {
    url: () => 'https://claude.ai/new',
    prefill: false,
  },
  gemini: {
    url: () => 'https://gemini.google.com/app',
    prefill: false,
  },
  grok: {
    url: () => 'https://grok.com/',
    prefill: false,
  },
  deepseek: {
    url: () => 'https://chat.deepseek.com/',
    prefill: false,
  },
};

const applyUiText = (root, text) => {
  const kicker = root.querySelector('[data-ask-ai-kicker]');
  const title = root.querySelector('[data-ask-ai-title]');
  const subtitle = root.querySelector('[data-ask-ai-subtitle]');
  const toggleLabel = root.querySelector('[data-prompt-toggle-label]');
  const copyButton = root.querySelector('[data-copy-prompt]');

  if (kicker) kicker.textContent = text.kicker;
  if (title) title.textContent = text.title;
  if (subtitle) subtitle.textContent = text.subtitle;
  if (toggleLabel) toggleLabel.textContent = text.viewPrompt;
  if (copyButton) copyButton.textContent = text.copy;
};

const fallbackCopy = (text) => {
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', 'true');
  input.style.position = 'fixed';
  input.style.top = '-9999px';
  document.body.appendChild(input);
  input.focus();
  input.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(input);
  return copied;
};

const copyText = async (text) => {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      return fallbackCopy(text);
    }
  }
  return fallbackCopy(text);
};

const createFeedbackController = (root) => {
  const feedback = root.querySelector('[data-copy-feedback]');
  let timerId = null;
  return {
    show(message) {
      if (!feedback) {
        return;
      }
      feedback.textContent = message;
      feedback.classList.add('is-visible');
      if (timerId) {
        window.clearTimeout(timerId);
      }
      timerId = window.setTimeout(() => {
        feedback.classList.remove('is-visible');
      }, 1800);
    },
  };
};

const bindPromptToggle = (root, text) => {
  const toggle = root.querySelector('[data-prompt-toggle]');
  const disclosure = root.querySelector('.ask-ai-disclosure');
  const label = root.querySelector('[data-prompt-toggle-label]');
  if (!toggle || !disclosure) {
    return;
  }
  disclosure.classList.add('is-open');
  if (label) {
    label.textContent = text.hidePrompt;
  }
  toggle.addEventListener('click', () => {
    const isOpen = disclosure.classList.toggle('is-open');
    if (label) {
      label.textContent = isOpen ? text.hidePrompt : text.viewPrompt;
    }
  });
};

const bindCopyPrompt = (root, prompt, text) => {
  const copyButton = root.querySelector('[data-copy-prompt]');
  if (!copyButton) {
    return;
  }
  const feedbackController = createFeedbackController(root);
  copyButton.addEventListener('click', async () => {
    const copied = await copyText(prompt);
    feedbackController.show(copied ? text.copySuccess : text.copyFailure);
  });
};

const bindProviders = (root, prompt, text) => {
  const feedbackController = createFeedbackController(root);
  const pills = root.querySelectorAll('[data-provider]');

  pills.forEach((pill) => {
    const providerKey = pill.dataset.provider || '';
    const provider = providers[providerKey];
    if (!provider) {
      return;
    }

    if (provider.prefill) {
      // Primary: set href directly, browser handles navigation
      pill.setAttribute('href', provider.url(prompt));
      return;
    }

    // Secondary: copy prompt first, then redirect
    pill.addEventListener('click', async () => {
      if (pill.classList.contains('is-copied')) {
        return;
      }
      const originalLabel = pill.querySelector('.ask-ai-pill-label');
      const originalText = originalLabel ? originalLabel.textContent : '';

      pill.classList.add('is-copied');
      const copied = await copyText(prompt);

      if (copied && originalLabel) {
        originalLabel.textContent = `${text.copiedRedirect} ${originalText}…`;
      }
      feedbackController.show(copied ? text.copySuccess : text.copyFailure);

      window.setTimeout(() => {
        window.open(provider.url(prompt), '_blank', 'noopener,noreferrer');
        pill.classList.remove('is-copied');
        if (originalLabel) {
          originalLabel.textContent = originalText;
        }
      }, 800);
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
  const prompt = buildPrompt({ params, language, fallbackLang: pageData.lang });
  const promptOutput = root.querySelector('[data-prompt-output]');

  applyUiText(root, text);
  if (promptOutput) {
    promptOutput.textContent = prompt;
  }
  bindPromptToggle(root, text);
  bindCopyPrompt(root, prompt, text);
  bindProviders(root, prompt, text);
};
