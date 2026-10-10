// Shared by the generator and the client so word counts read the same everywhere.
// ponytail: fixed reading speeds (400 字/min, 230 words/min); tune here if they feel off.
const PER_MINUTE = { zh: 400, en: 230 };

export const readingMinutes = (words, lang) =>
  Math.max(1, Math.round((words || 0) / (PER_MINUTE[lang] || PER_MINUTE.en)));

export const formatMinutes = (minutes, lang) =>
  lang === 'zh' ? `${minutes} 分钟` : `${minutes} min`;

export const formatWords = (words, lang) =>
  `${(words || 0).toLocaleString('en-US')} ${lang === 'zh' ? '字' : 'words'}`;
