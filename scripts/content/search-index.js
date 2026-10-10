// Full-text search index, fetched by the nav search the first time it opens.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

export const htmlToText = (html) =>
  String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name) => ENTITIES[name])
    .replace(/\s+/g, ' ')
    .trim();

export const buildSearchIndex = (listDataByLang) =>
  listDataByLang.flatMap((group) =>
    group.items.map((post) => ({
      url: post.url,
      lang: post.lang,
      title: post.title,
      date: post.date,
      text: htmlToText(post.contentHtml),
    }))
  );
