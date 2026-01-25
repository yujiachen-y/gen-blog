import MarkdownIt from 'markdown-it';
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
