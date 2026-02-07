import { pageData } from './state.js';
import { buildPrompt, resolveUiLanguage } from './ask-ai-prompt.js';

const uiText = {
  en: {
    kicker: 'ASK AI',
    title: 'Ask anything about me.',
    subtitle: "It's done its homework. Ask away.",
    subtitlePost: 'It just read "%TITLE%" — and everything else.',
    badge: 'one-click',
    separator: 'or copy prompt to',
    copy: 'Copy',
    copySuccess: 'Copied prompt.',
    copyFailure: 'Copy failed. Please copy manually.',
    copying: 'Copying',
    copiedRedirect: 'Copied! Opening',
  },
  zh: {
    kicker: 'ASK AI',
    title: '让 AI 替你翻翻我的博客。',
    subtitle: '如你所料，这个网站的信息它都知道。',
    subtitlePost: '它刚读完《%TITLE%》——还有我所有其他文章。',
    badge: '一键直达',
    separator: '或复制 prompt 到',
    copy: '复制',
    copySuccess: '已复制，去粘贴吧。',
    copyFailure: '复制失败，请手动复制。',
    copying: '正在拷贝',
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

const applyUiText = (root, text, params) => {
  const kicker = root.querySelector('[data-ask-ai-kicker]');
  const title = root.querySelector('[data-ask-ai-title]');
  const subtitle = root.querySelector('[data-ask-ai-subtitle]');
  const badgeLabel = root.querySelector('[data-badge-label]');
  const separatorLabel = root.querySelector('[data-separator-label]');
  const copyButton = root.querySelector('[data-copy-prompt]');

  if (kicker) kicker.textContent = text.kicker;
  if (title) title.textContent = text.title;
  if (subtitle) {
    const postTitle = params.get('from') === 'post' ? (params.get('title') || '').trim() : '';
    subtitle.textContent = postTitle
      ? text.subtitlePost.replace('%TITLE%', postTitle)
      : text.subtitle;
  }
  if (badgeLabel) badgeLabel.textContent = text.badge;
  if (separatorLabel) separatorLabel.textContent = text.separator;
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
      const brandLockup = pill.querySelector('.ask-ai-brand-lockup');
      const providerName = (pill.getAttribute('aria-label') || providerKey).trim();
      let statusLabel = originalLabel;
      let createdStatusLabel = false;
      const originalText = originalLabel ? originalLabel.textContent : '';

      if (!statusLabel) {
        statusLabel = document.createElement('span');
        statusLabel.className = 'ask-ai-provider-status';
        pill.appendChild(statusLabel);
        createdStatusLabel = true;
      }
      if (brandLockup) {
        brandLockup.classList.add('is-hidden');
      }
      statusLabel.textContent = `${text.copying}…`;
      statusLabel.classList.add('is-visible');

      pill.classList.add('is-copied');
      const copied = await copyText(prompt);

      if (copied && statusLabel) {
        statusLabel.textContent = `${text.copiedRedirect} ${providerName}…`;
      }
      feedbackController.show(copied ? text.copySuccess : text.copyFailure);

      window.setTimeout(() => {
        window.open(provider.url(prompt), '_blank', 'noopener,noreferrer');
        pill.classList.remove('is-copied');
        if (brandLockup) {
          brandLockup.classList.remove('is-hidden');
        }
        if (statusLabel) {
          statusLabel.classList.remove('is-visible');
        }
        if (createdStatusLabel && statusLabel && statusLabel.parentNode === pill) {
          pill.removeChild(statusLabel);
        } else if (statusLabel) {
          statusLabel.textContent = originalText;
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

  applyUiText(root, text, params);
  if (promptOutput) {
    promptOutput.textContent = prompt;
  }
  bindCopyPrompt(root, prompt, text);
  bindProviders(root, prompt, text);
};
