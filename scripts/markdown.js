import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';

const applyWikilinkHook = (source, wikilinkHook) => {
  if (typeof wikilinkHook !== 'function') {
    return source;
  }

  return wikilinkHook(source);
};

export const createMarkdownRenderer = (options = {}) => {
  const {
    allowHtml = false,
    linkify = true,
    typographer = true,
    breaks = false,
    wikilinkHook = null,
  } = options;

  const md = new MarkdownIt({
    html: allowHtml,
    linkify,
    typographer,
    breaks,
  });

  md.set({
    highlight: (str, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`;
        } catch (error) {
          // Fall through to plain text rendering.
        }
      }
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    },
  });

  md.use(taskLists, {
    enabled: true,
    label: true,
    labelAfter: true,
  });
  md.use(footnote);

  return {
    md,
    render(source) {
      return md.render(applyWikilinkHook(source, wikilinkHook));
    },
  };
};

export const renderMarkdown = (source, options = {}) =>
  createMarkdownRenderer(options).render(source);
