// Run: node scripts/self-check.js
import assert from 'node:assert/strict';
import { countWords } from './shared/list-presenter.js';
import { formatMinutes, readingMinutes } from '../theme/app/reading.js';
import { ageOf, yearAge } from '../theme/app/age.js';
import { buildFrontmatterHtml } from './content/frontmatter.js';
import { htmlToText } from './content/search-index.js';
import { buildTocHtml } from './content/pages.js';

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
const titled = buildTocHtml(
  [
    { level: 1, id: 't', text: 'Title' },
    { level: 2, id: 'a', text: 'A' },
    { level: 2, id: 'b', text: 'B' },
  ],
  'en'
);
assert.doesNotMatch(titled, /toc-level-1/);
assert.match(titled, /toc-level-2 toc-top[^>]*><a class="sidebar-link" href="#b"/);

console.log('self-check ok');
