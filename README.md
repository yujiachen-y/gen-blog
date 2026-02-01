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
  "fontCssUrls": ["https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap"],
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

## License
MIT. See `LICENSE`.
