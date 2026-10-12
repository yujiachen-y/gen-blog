export const uiText = {
  en: {
    kicker: 'ASK · AI',
    title: 'Ask about what I’ve written.',
    subtitle: 'Your question opens in ChatGPT, with my posts as context.',
    subtitlePost:
      'Your question opens in ChatGPT, with "%TITLE%" and the rest of my posts as context.',
    placeholder: 'A post, an idea, a year…',
    ask: 'Ask',
    separator: 'Or copy the prompt for',
    showPrompt: 'Show the prompt',
    hidePrompt: 'Hide the prompt',
    copy: 'Copy',
    copySuccess: 'Copied prompt.',
    copyFailure: 'Copy failed. Please copy manually.',
    copying: 'Copying',
    copiedRedirect: 'Copied! Opening',
  },
  zh: {
    kicker: '问 · AI',
    title: '让 AI 替你翻翻我的博客。',
    subtitle: '你的问题会带着我的文章，在 ChatGPT 里打开。',
    subtitlePost: '你的问题会带着《%TITLE%》和我的其他文章，在 ChatGPT 里打开。',
    placeholder: '一篇文章、一个想法、某一年…',
    ask: '提问',
    separator: '或者复制 prompt 给',
    showPrompt: '查看 prompt',
    hidePrompt: '收起 prompt',
    copy: '复制',
    copySuccess: '已复制，去粘贴吧。',
    copyFailure: '复制失败，请手动复制。',
    copying: '正在拷贝',
    copiedRedirect: '已复制！正在打开',
  },
};

export const providers = {
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

export const normalizeQuestion = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

export const buildPromptWithQuestion = ({ basePrompt, question, language }) => {
  const normalizedQuestion = normalizeQuestion(question);
  if (!normalizedQuestion) {
    return basePrompt;
  }
  const questionLine =
    language === 'zh' ? `用户问题：${normalizedQuestion}` : `User question: ${normalizedQuestion}`;
  const trailingBreak = basePrompt.endsWith('\n') ? '' : '\n';
  return `${basePrompt}${trailingBreak}${questionLine}\n`;
};
