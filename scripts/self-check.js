// Run: node scripts/self-check.js
import assert from 'node:assert/strict';
import { countWords } from './shared/list-presenter.js';
import { formatMinutes, readingMinutes } from '../theme/app/reading.js';
import { ageOf, yearAge } from '../theme/app/age.js';
import { buildFrontmatterHtml } from './content/frontmatter.js';
import { htmlToText } from './content/search-index.js';
import { buildTocHtml } from './content/pages.js';
import { settleHeadings } from './content/headings.js';
import { createFooterBuilder, createPostNavBuilder } from './content/footer.js';

assert.equal(countWords('<p>简单 vs 容易, it’s <b>simple</b></p>'), 4 + 3);
assert.equal(readingMinutes(4000, 'zh'), 10);
assert.equal(readingMinutes(10, 'en'), 1);
assert.equal(formatMinutes(3, 'zh'), '3 分钟');

const html = buildFrontmatterHtml({
  date: '2021-09-27',
  lang: 'zh',
  categories: ['Tech'],
  wordCount: 3830,
  languages: ['en', 'zh'],
  langSwitchUrl: '/x/',
});
assert.match(html, /<time datetime="2021-09-27">/);
assert.match(html, /<dd>#tech<\/dd>/);
assert.match(html, /3,830 字 · 10 分钟/);
assert.match(html, /<a href="\/x\/" hreflang="en">en<\/a> · <span aria-current="true">zh<\/span>/);
assert.doesNotMatch(buildFrontmatterHtml({ date: '2021-01-01', lang: 'en' }), /lang<\/dt>/);

const now = Date.parse('2026-01-01');
assert.equal(ageOf('2026-01-01', now), 0);
assert.equal(ageOf('2022-01-01', now), 0.5);
assert.equal(ageOf('2010-01-01', now), 1);
assert.equal(ageOf('not a date', now), 0);
assert.equal(yearAge('2022', now), ageOf('2022-07-01', now));

assert.equal(htmlToText('<p>A&amp;B</p><script>x()</script><b>事务</b>'), 'A&B 事务');

const toc = buildTocHtml(
  [
    { level: 2, id: 'a', text: 'A' },
    { level: 3, id: 'b', text: 'B' },
    { level: 4, id: 'c', text: 'C' },
  ],
  'en'
);
assert.match(toc, /toc-level-2 toc-top/);
assert.match(toc, /toc-level-3"/);
assert.doesNotMatch(toc, /toc-level-4/);
const lone = settleHeadings(
  '<blockquote>x</blockquote><h1 id="t">Long <em>title</em></h1><h2 id="a">A</h2>',
  [
    { level: 1, id: 't', text: 'Long title' },
    { level: 2, id: 'a', text: 'A' },
  ]
);
assert.equal(lone.subtitleHtml, 'Long <em>title</em>');
assert.equal(lone.html, '<blockquote>x</blockquote><h2 id="a">A</h2>');
assert.deepEqual(
  lone.toc.map((item) => item.level),
  [2]
);
const sections = settleHeadings('<h1 id="a">A</h1><h2>a</h2><h1 id="b">B</h1>', [
  { level: 1, id: 'a', text: 'A' },
  { level: 2, id: 'x', text: 'a' },
  { level: 1, id: 'b', text: 'B' },
]);
assert.equal(sections.subtitleHtml, '');
assert.equal(sections.html, '<h2 id="a">A</h2><h3>a</h3><h2 id="b">B</h2>');
assert.deepEqual(
  sections.toc.map((item) => item.level),
  [2, 3, 2]
);
assert.equal(settleHeadings('<h2>A</h2>').html, '<h2>A</h2>');
const repeated = settleHeadings(
  '<blockquote>x</blockquote><h1>Same  Title</h1><p>y</p>',
  [],
  'same title'
);
assert.equal(repeated.subtitleHtml, '');
assert.equal(repeated.html, '<blockquote>x</blockquote><p>y</p>');

const items = ['/c/', '/b/', '/a/'].map((url, i) => ({
  url,
  title: url,
  date: `202${3 - i}-01-01`,
  wordCount: 100,
}));
const footerFor = createFooterBuilder({
  listDataByLang: [{ lang: 'zh', items }],
  social: [],
  siteTitle: 'A B',
});
const middle = footerFor('zh', '/b/');
assert.match(middle, /page-curl-newer" href="\/c\/"/);
assert.match(middle, /page-curl-older" href="\/a\/"/);
assert.doesNotMatch(footerFor('zh', '/c/'), /page-curl-newer/);
assert.doesNotMatch(footerFor('zh'), /page-curl/);
assert.match(footerFor('zh'), /3 篇 · 300 字 · 2021–2023/);
assert.doesNotMatch(footerFor('zh'), /ink-well-invite/);
const invited = createFooterBuilder({
  listDataByLang: [{ lang: 'zh', items }],
  invite: { zh: '你好' },
});
assert.match(invited('zh'), /ink-well-invite">你好</);
assert.doesNotMatch(invited('en'), /ink-well-invite/);
const postNavFor = createPostNavBuilder({ listDataByLang: [{ lang: 'zh', items }] });
assert.match(
  postNavFor('zh', '/b/'),
  /post-nav-newer" href="\/c\/"[\s\S]*← 较新[\s\S]*post-nav-older" href="\/a\/"/
);
assert.doesNotMatch(postNavFor('zh', '/a/'), /post-nav-older/);
assert.equal(postNavFor('zh', '/missing/'), '');

console.log('self-check ok');
