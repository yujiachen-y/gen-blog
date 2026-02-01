import { pageData } from './state.js';

const CUSDIS_API = 'https://cusdis.com';

const commentLabels = {
  en: {
    title: 'COMMENTS',
    nickname: 'Nickname',
    email: 'Email (optional)',
    placeholder: 'Leave a comment...',
    submit: 'Submit',
    reply: 'Reply',
    cancel: 'Cancel',
    pending: 'Your comment is pending approval.',
    empty: 'No comments yet.',
  },
  zh: {
    title: '评论',
    nickname: '昵称',
    email: '邮箱（选填）',
    placeholder: '写下你的评论...',
    submit: '提交',
    reply: '回复',
    cancel: '取消',
    pending: '你的评论正在等待审核。',
    empty: '暂无评论。',
  },
};

const fetchComments = async (config, page = 1) => {
  const params = new URLSearchParams({
    appId: config.appId,
    pageId: config.pageId,
    page: String(page),
  });
  const res = await fetch(`${CUSDIS_API}/api/open/comments?${params}`);
  if (!res.ok) throw new Error('fetch comments failed');
  const json = await res.json();
  return json.data;
};

const postComment = async (config, body) => {
  const res = await fetch(`${CUSDIS_API}/api/open/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('post comment failed');
  return res.json();
};

const formatCommentDate = (raw) => {
  try {
    const d = new Date(raw);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return raw || '';
  }
};

const buildCommentEl = (comment, labels, config, depth = 0) => {
  const article = document.createElement('article');
  article.className = depth > 0 ? 'comment comment-child' : 'comment';

  const header = document.createElement('div');
  header.className = 'comment-header';
  const name = document.createElement('span');
  name.className = 'comment-author';
  name.textContent = comment.by_nickname || 'Anonymous';
  const date = document.createElement('span');
  date.className = 'comment-date';
  date.textContent = formatCommentDate(comment.createdAt);
  header.append(name, date);

  const body = document.createElement('div');
  body.className = 'comment-body';
  body.textContent = comment.content;

  article.append(header, body);

  if (depth === 0) {
    const replyBtn = document.createElement('button');
    replyBtn.className = 'comment-reply-btn';
    replyBtn.type = 'button';
    replyBtn.textContent = labels.reply;
    replyBtn.addEventListener('click', () => {
      if (article.querySelector('.comment-reply-form')) return;
      const form = buildCommentForm(labels, config, comment.id, () => {
        form.remove();
      });
      form.classList.add('comment-reply-form');
      article.appendChild(form);
    });
    article.appendChild(replyBtn);
  }

  if (comment.replies && comment.replies.data && comment.replies.data.length) {
    const repliesWrap = document.createElement('div');
    repliesWrap.className = 'comment-replies';
    comment.replies.data.forEach((reply) => {
      repliesWrap.appendChild(buildCommentEl(reply, labels, config, depth + 1));
    });
    article.appendChild(repliesWrap);
  }

  return article;
};

const buildCommentForm = (labels, config, parentId, onCancel) => {
  const form = document.createElement('form');
  form.className = 'comment-form';

  const row = document.createElement('div');
  row.className = 'comment-form-row';

  const nicknameInput = document.createElement('input');
  nicknameInput.type = 'text';
  nicknameInput.className = 'comment-input';
  nicknameInput.placeholder = labels.nickname;
  nicknameInput.required = true;

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.className = 'comment-input';
  emailInput.placeholder = labels.email;

  row.append(nicknameInput, emailInput);

  const textarea = document.createElement('textarea');
  textarea.className = 'comment-textarea';
  textarea.placeholder = labels.placeholder;
  textarea.required = true;
  textarea.rows = 3;

  const actions = document.createElement('div');
  actions.className = 'comment-form-actions';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'comment-submit';
  submitBtn.textContent = labels.submit;

  actions.appendChild(submitBtn);

  if (onCancel) {
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'comment-cancel';
    cancelBtn.textContent = labels.cancel;
    cancelBtn.addEventListener('click', onCancel);
    actions.insertBefore(cancelBtn, submitBtn);
  }

  form.append(row, textarea, actions);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    try {
      await postComment(config, {
        appId: config.appId,
        pageId: config.pageId,
        content: textarea.value.trim(),
        nickname: nicknameInput.value.trim(),
        email: emailInput.value.trim() || undefined,
        parentId: parentId || undefined,
      });
      form.reset();
      if (onCancel) {
        onCancel();
      } else {
        const section = document.querySelector('[data-comment-section]');
        const pending = section && section.querySelector('.comment-pending');
        if (pending) pending.hidden = false;
      }
    } catch {
      // degrade silently
    } finally {
      submitBtn.disabled = false;
    }
  });

  return form;
};

export const initComments = async () => {
  const config = pageData.comments;
  if (!config) return;

  const section = document.querySelector('[data-comment-section]');
  if (!section) return;

  const lang = pageData.lang || 'en';
  const labels = commentLabels[lang] || commentLabels.en;

  const label = document.createElement('div');
  label.className = 'comment-label';
  label.textContent = labels.title;
  section.appendChild(label);

  const list = document.createElement('div');
  list.className = 'comment-list';
  section.appendChild(list);

  const empty = document.createElement('div');
  empty.className = 'comment-empty';
  empty.textContent = labels.empty;
  empty.hidden = true;
  section.appendChild(empty);

  const loadMore = document.createElement('button');
  loadMore.type = 'button';
  loadMore.className = 'comment-load-more';
  loadMore.textContent = 'Load more';
  loadMore.hidden = true;
  section.appendChild(loadMore);

  const mainForm = buildCommentForm(labels, config, null, null);
  section.appendChild(mainForm);

  const pending = document.createElement('div');
  pending.className = 'comment-pending';
  pending.textContent = labels.pending;
  pending.hidden = true;
  section.appendChild(pending);

  let currentPage = 1;
  let pageCount = 1;

  const renderPage = (data) => {
    (data.data || []).forEach((comment) => {
      list.appendChild(buildCommentEl(comment, labels, config));
    });
    pageCount = data.pageCount || 1;
    empty.hidden = list.children.length > 0;
    loadMore.hidden = currentPage >= pageCount;
  };

  try {
    const data = await fetchComments(config, 1);
    renderPage(data);
  } catch {
    // degrade silently
  }

  loadMore.addEventListener('click', async () => {
    loadMore.disabled = true;
    try {
      currentPage += 1;
      const data = await fetchComments(config, currentPage);
      renderPage(data);
    } catch {
      // degrade silently
    } finally {
      loadMore.disabled = false;
    }
  });
};
