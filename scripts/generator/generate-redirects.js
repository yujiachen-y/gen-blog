import path from 'node:path';
import { writePage } from '../shared/fs-utils.js';
import { buildListUrl, buildRootRedirectPath, stripLeadingSlash } from '../shared/paths.js';

const escapeHtmlValue = (value) =>
  String(value || '').replace(
    /[<>&"]/g,
    (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch]
  );

const escapeJsString = (value) => String(value || '').replace(/[\\'"]/g, (ch) => `\\${ch}`);

const buildAutoDetectScript = (langTargets) => {
  const en = escapeJsString(langTargets.en || langTargets.default);
  const zh = escapeJsString(langTargets.zh || langTargets.default);
  return `var stored = localStorage.getItem('gen-blog-lang');
    var nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    var prefers = stored || (nav.indexOf('zh') === 0 ? 'zh' : 'en');
    target = prefers === 'zh' ? '${zh}' : '${en}';`;
};

const buildRootRedirectHtml = ({ targetUrl, lang, siteTitle, autoDetect, langTargets }) => {
  const safeTarget = escapeJsString(targetUrl);
  const safeTitle = escapeHtmlValue(siteTitle);
  const detectBlock = autoDetect ? buildAutoDetectScript(langTargets) : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<link rel="canonical" href="${targetUrl}" />
<meta http-equiv="refresh" content="0; url=${targetUrl}" />
<style>body{margin:0;font:14px system-ui,sans-serif;color:#666;background:#fafaf7;display:flex;align-items:center;justify-content:center;min-height:100vh}</style>
</head>
<body>
<p>Redirecting to <a href="${targetUrl}">${targetUrl}</a>…</p>
<script>(function(){
  try {
    var target = '${safeTarget}';
    ${detectBlock}
    window.location.replace(target);
  } catch (e) {
    window.location.replace('${safeTarget}');
  }
})();</script>
</body>
</html>
`;
};

export const writeRootRedirects = async ({ languages, defaultLang, siteTitle, buildDir }) => {
  if (!Array.isArray(languages) || languages.length === 0) return;
  const langTargets = languages.reduce(
    (acc, lang) => {
      acc[lang] = buildListUrl(lang, defaultLang);
      return acc;
    },
    { default: buildListUrl(defaultLang, defaultLang) }
  );
  await Promise.all(
    languages.map(async (lang) => {
      const targetUrl = buildListUrl(lang, defaultLang);
      const rootPath = buildRootRedirectPath(lang, defaultLang);
      const autoDetect = lang === defaultLang;
      const html = buildRootRedirectHtml({
        targetUrl,
        lang,
        siteTitle,
        autoDetect,
        langTargets,
      });
      await writePage(path.join(buildDir, stripLeadingSlash(rootPath)), html);
    })
  );
};
