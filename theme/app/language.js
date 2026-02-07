export const normalizeLanguage = (value) => {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw.startsWith('zh')) {
    return 'zh';
  }
  if (raw.startsWith('en')) {
    return 'en';
  }
  return null;
};
