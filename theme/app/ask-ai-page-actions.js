import { providers } from './ask-ai-page-config.js';

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

export const bindCopyPrompt = (root, getPrompt, text) => {
  const copyButton = root.querySelector('[data-copy-prompt]');
  if (!copyButton) {
    return;
  }
  const feedbackController = createFeedbackController(root);
  copyButton.addEventListener('click', async () => {
    const copied = await copyText(getPrompt());
    feedbackController.show(copied ? text.copySuccess : text.copyFailure);
  });
};

export const bindProviders = (root, getPrompt, text) => {
  const feedbackController = createFeedbackController(root);
  const pills = Array.from(root.querySelectorAll('[data-provider]'));

  const refreshPrefillProviders = () => {
    pills.forEach((pill) => {
      const providerKey = pill.dataset.provider || '';
      const provider = providers[providerKey];
      if (!provider || !provider.prefill) {
        return;
      }
      pill.setAttribute('href', provider.url(getPrompt()));
    });
  };

  refreshPrefillProviders();

  pills.forEach((pill) => {
    const providerKey = pill.dataset.provider || '';
    const provider = providers[providerKey];
    if (!provider || provider.prefill) {
      return;
    }

    // No URL prefill for these: copy the prompt first, then open the assistant.
    pill.addEventListener('click', async () => {
      if (pill.classList.contains('is-copied')) {
        return;
      }
      const name = pill.textContent.trim();
      pill.classList.add('is-copied');
      pill.textContent = `${text.copying}…`;
      const nextPrompt = getPrompt();
      const copied = await copyText(nextPrompt);
      if (copied) {
        pill.textContent = `${text.copiedRedirect} ${name}…`;
      }
      feedbackController.show(copied ? text.copySuccess : text.copyFailure);

      window.setTimeout(() => {
        window.open(provider.url(nextPrompt), '_blank', 'noopener,noreferrer');
        pill.classList.remove('is-copied');
        pill.textContent = name;
      }, 800);
    });
  });

  return { refreshPrefillProviders };
};

export const openChatGpt = (prompt) => {
  const url = providers.chatgpt.url(prompt);
  window.open(url, '_blank', 'noopener,noreferrer');
};
