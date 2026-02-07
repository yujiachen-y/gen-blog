export const uiText = {
  en: {
    kicker: '',
    title: 'Ask anything about me.',
    subtitle: 'Ask directly and get answers grounded in this blog.',
    subtitlePost: 'It just read "%TITLE%" — and the rest of this blog.',
    trust: 'Answers include citations to posts.',
    placeholder: 'Ask me anything about this blog...',
    ask: 'Ask',
    chips: ['Summarize recent posts', 'Top 3 posts', 'Writing topics'],
    providerNote: 'Prefer ChatGPT?',
    providerLink: 'One-click prompt',
    promptPanel: 'Prompt panel',
    separator: 'or copy prompt to',
    promptTitle: 'Need to paste in other apps?',
    promptDescription: 'Expand the prompt panel to copy full context or open Claude and Gemini.',
    copy: 'Copy',
    copySuccess: 'Copied prompt.',
    copyFailure: 'Copy failed. Please copy manually.',
    copying: 'Copying',
    copiedRedirect: 'Copied! Opening',
  },
  zh: {
    kicker: '',
    title: '让 AI 替你翻翻我的博客。',
    subtitle: '直接提问，立即获得基于博客内容的回答。',
    subtitlePost: '它刚读完《%TITLE%》——还有我所有其他文章。',
    trust: '回答会附引用来源。',
    placeholder: '问我任何关于这个博客的问题…',
    ask: '提问',
    chips: ['总结近文', '推荐 3 篇必读', '我写过哪些主题？'],
    providerNote: '用 ChatGPT？',
    providerLink: '一键带入 Prompt',
    promptPanel: 'Prompt 面板',
    separator: '或复制 prompt 到',
    promptTitle: '要在其他应用里粘贴吗？',
    promptDescription: '展开 Prompt 面板，可复制完整上下文，或打开 Claude / Gemini。',
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
