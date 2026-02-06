import fs from 'node:fs/promises';
import path from 'node:path';

export const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const readTemplate = (themeDir, fileName) =>
  fs.readFile(path.join(themeDir, fileName), 'utf8');

export const renderTemplate = (template, values) =>
  Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value ?? '')),
    template
  );

export const buildFontLinks = (urls) => {
  if (!urls || urls.length === 0) {
    return '';
  }
  const links = [];
  if (urls.some((url) => url.includes('fonts.googleapis.com'))) {
    links.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
    links.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
  }
  urls.forEach((url) => {
    links.push(`<link rel="stylesheet" href="${escapeHtml(url)}" />`);
  });
  return links.join('\n');
};

export const buildIconLinks = (icons) =>
  icons
    .map((icon) => {
      const attrs = [
        `rel="${escapeHtml(icon.rel)}"`,
        `href="${escapeHtml(icon.href)}"`,
        icon.type ? `type="${escapeHtml(icon.type)}"` : null,
        icon.sizes ? `sizes="${escapeHtml(icon.sizes)}"` : null,
      ]
        .filter(Boolean)
        .join(' ');
      return `<link ${attrs} />`;
    })
    .join('\n');
