# Gen Blog

A personal Obsidian-to-static blog generator with bilingual support, dark mode, pagination, and SEO-friendly post pages. It produces static HTML and a lightweight client-side filter index.

## Features

- Bilingual pages (zh/en) with language toggle
- Static HTML posts + list pages
- SEO metadata and sitemap/robots generation
- RSS feeds (`/rss.xml`, `/rss-<lang>.xml`) when `siteUrl` is configured
- Obsidian-friendly markdown transforms (callouts, embeds, comments)
- Image pipeline (local + data URI; optional remote fetch)
- Font subsetting for configured theme fonts
- Ask AI page with one-click ChatGPT + copy-first provider shortcuts

## Requirements

- Node.js 18+ (for built-in `fetch` and ES modules)

## Install

```
npm install
```

## Usage

```
npm run generate -- <vaultDir> [outputDir] [--site-url <url>]
```

### Example

```
npm run generate -- /path/to/vault dist --site-url https://example.com
```

## Configuration (optional)

Create `blog.config.json` at `$VAULT/.blog/`:

```json
{
  "siteTitle": "My Blog",
  "siteUrl": "https://example.com",
  "allowRemoteImages": false,
  "fontCssUrls": [
    "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap"
  ],
  "comments": {
    "appId": "your-cusdis-app-id"
  }
}
```

- `siteTitle`: string, optional
- `siteUrl`: string, optional (used for canonical/sitemap)
- `allowRemoteImages`: boolean, default `false` (when true, remote HTTP(S) images are downloaded into `assets/`)
- `fontCssUrls`: string or string[], optional (external font stylesheet URLs). If omitted, no external font CSS is included.
- `comments`: object, optional (enable Cusdis comments when configured; `appId` is required)

### Theme assets (optional)

Place theme assets under `$VAULT/.blog/theme/`:

```
.blog/
  blog.config.json
  theme/
    favicon.svg
    favicon-32.png
    favicon.png
    apple-touch-icon.png
    fonts.css
    fonts/
      *.woff2
```

- Icons are included only if the corresponding files exist.
- `fonts.css` is optional; when present it is copied to `/fonts.css` in the output and can define `@font-face` and set CSS variables such as `--font-ui` and `--font-body`.

## Notes

- The generator deletes `outputDir` when it is not a GitHub Pages repo (no `.git`, `CNAME`, `.nojekyll`). Use a dedicated output folder.
- Remote images are disabled by default for privacy/security; enable explicitly if needed.

## Post artifacts

A post can ship companion static assets (slide decks, interactive demos, notebooks, etc.) via the optional `blog_artifacts` frontmatter field. Each artifact lives in the vault next to the post and is copied verbatim to a configured URL; the generated post HTML renders a banner linking to it.

```yaml
---
blog_publish: true
blog_title: My Post
blog_date: 2026-04-24
blog_lang: zh
blog_translation_key: my-post
blog_category:
  - Essays
blog_artifacts:
  - type: slides # free-form label; known types drive default banner text
    source: ./my-post.slides # path relative to this md file (dir or single file)
    url: /my-post-slides/ # absolute site URL path; must not collide with any post URL
    label: 打开演示稿（30 张） # optional; falls back to a type + language default
---
```

- Sources may be a directory (copied recursively, opaque) or a single file.
- URLs must start and end with `/`. The generator errors out on collisions with post URLs or duplicate artifact URLs.
- Artifacts are added to the sitemap but not to RSS, filter index, or `llms.txt`.

## License

MIT. See `LICENSE`.
