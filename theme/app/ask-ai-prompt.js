import { pageData } from './state.js';
import { normalizeLanguage } from './language.js';

const normalizePath = (value, emptyValue) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return emptyValue;
  }
  if (raw.startsWith('/')) {
    return raw;
  }
  return `/${raw.replace(/^\/+/, '')}`;
};

const normalizeSourcePath = (value) => normalizePath(value, '/');
const normalizeMarkdownPath = (value) => normalizePath(value, null);

const normalizeBlogTitle = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const buildBasePromptLines = ({ language, llmsUrl, blogTitle }) =>
  language === 'zh'
    ? [
        `请帮助用户更好地了解「${blogTitle || '这个博客'}」。`,
        `请将这个博客的 llms.txt 作为站点结构与内容入口：${llmsUrl}`,
        '在回答问题时，如果需要更多上下文，请阅读 llms.txt 中相关链接文章。',
        '这个博客的主要文章语言为中文和英文。',
        '回答时请严格遵循用户的指令与约束。',
      ]
    : [
        `Please help the user better understand "${blogTitle || 'this blog'}".`,
        `Use this blog's llms.txt as the primary map of the site: ${llmsUrl}`,
        'Read relevant linked posts from llms.txt whenever you need more context to answer questions accurately.',
        'The main articles are written in Chinese and English.',
        "Follow the user's instructions and constraints when responding.",
      ];

const buildPostContextLine = ({ params, language, fallbackLang }) => {
  if (params.get('from') !== 'post') {
    return null;
  }
  const sourcePath = normalizeSourcePath(params.get('src'));
  const sourceUrl = new URL(sourcePath, window.location.origin).toString();
  const markdownPath = normalizeMarkdownPath(params.get('md'));
  const markdownUrl = markdownPath ? new URL(markdownPath, window.location.origin).toString() : '';
  const sourceTitle =
    String(params.get('title') || 'Untitled article')
      .replace(/\s+/g, ' ')
      .trim() || 'Untitled article';
  const sourceLang =
    normalizeLanguage(params.get('lang')) || normalizeLanguage(fallbackLang) || 'en';

  if (language === 'zh') {
    return (
      `用户是从这篇文章进入的："${sourceTitle}"（${sourceUrl}，language: ${sourceLang}）。` +
      `${markdownUrl ? `这篇文章对应的 canonical markdown 是：${markdownUrl}。` : ''}` +
      '用户现在很可能更关心与这篇文章相关的问题。'
    );
  }

  return (
    `The user came from this article: "${sourceTitle}" (${sourceUrl}, language: ${sourceLang}).` +
    `${markdownUrl ? ` The canonical markdown for this article is: ${markdownUrl}.` : ''}` +
    ' They are likely more interested in questions related to this article.'
  );
};

export const resolveUiLanguage = ({ params, fallbackLang, documentLang }) =>
  normalizeLanguage(params.get('ui')) ||
  normalizeLanguage(params.get('lang')) ||
  normalizeLanguage(fallbackLang) ||
  normalizeLanguage(documentLang) ||
  'en';

export const buildPrompt = ({ params, language, fallbackLang }) => {
  const llmsUrl = new URL('/llms.txt', window.location.origin).toString();
  const blogTitle = normalizeBlogTitle(pageData.siteTitle);
  const lines = buildBasePromptLines({ language, llmsUrl, blogTitle });
  const postContextLine = buildPostContextLine({ params, language, fallbackLang });
  if (postContextLine) {
    lines.push(postContextLine);
  }

  return `${lines.join('\n')}\n`;
};
