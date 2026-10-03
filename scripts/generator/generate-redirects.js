import path from 'node:path';
import { writePage } from '../shared/fs-utils.js';
import { buildListUrl, buildRootRedirectPath, stripLeadingSlash } from '../shared/paths.js';

const escapeHtmlValue = (value) =>
  String(value || '').replace(
    /[<>&"]/g,
    (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch]
  );

const escapeJsString = (value) => String(value || '').replace(/[\\'"]/g, (ch) => `\\${ch}`);

// "/" serves the default-language list directly (no redirect hop); visitors who
// prefer another language are sent to that list before the page renders.
export const buildRootLanguageScript = ({ languages, defaultLang }) => {
  if (!Array.isArray(languages) || languages.length < 2) return '';
  const listUrl = (lang) =>
    escapeJsString(buildListUrl(languages.includes(lang) ? lang : defaultLang, defaultLang));
  return `<script>(function(){
  try {
    var stored = localStorage.getItem('gen-blog-lang');
    var nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    var prefers = stored || (nav.indexOf('zh') === 0 ? 'zh' : 'en');
    var target = prefers === 'zh' ? '${listUrl('zh')}' : '${listUrl('en')}';
    if (target !== '${listUrl(defaultLang)}') window.location.replace(target);
  } catch (e) {}
})();</script>`;
};

const buildRootRedirectHtml = ({ targetUrl, lang, siteTitle }) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${escapeHtmlValue(siteTitle)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<link rel="canonical" href="${targetUrl}" />
<meta http-equiv="refresh" content="0; url=${targetUrl}" />
<style>body{margin:0;font:14px system-ui,sans-serif;color:#666;background:#fafaf7;display:flex;align-items:center;justify-content:center;min-height:100vh}</style>
</head>
<body>
<p>Redirecting to <a href="${targetUrl}">${targetUrl}</a>…</p>
<script>window.location.replace('${escapeJsString(targetUrl)}');</script>
</body>
</html>
`;

// The default language's root ("/") is written by the list page generator.
export const writeRootRedirects = async ({ languages, defaultLang, siteTitle, buildDir }) => {
  if (!Array.isArray(languages)) return;
  await Promise.all(
    languages
      .filter((lang) => lang !== defaultLang)
      .map(async (lang) => {
        const targetUrl = buildListUrl(lang, defaultLang);
        const rootPath = buildRootRedirectPath(lang, defaultLang);
        const html = buildRootRedirectHtml({ targetUrl, lang, siteTitle });
        await writePage(path.join(buildDir, stripLeadingSlash(rootPath)), html);
      })
  );
};
