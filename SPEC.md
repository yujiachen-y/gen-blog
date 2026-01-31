# Gen Blog — Requirements Spec

## Goal
Turn an Obsidian vault into a deployable static blog for `user.github.io`, with bilingual support, dark mode, pagination, and SEO‑friendly per‑post HTML pages.

## Inputs
- **Vault path**: provided as the first CLI argument to `npm run generate -- <vaultDir> <outputDir>`.
- **Output path**: defaults to `dist/`, but must support writing into a GitHub Pages repo (e.g. `../yourname.github.io`).
- **Optional config**: `blog.config.json` at `$VAULT/.blog/`:
  - `siteTitle` (string)
  - `siteUrl` (string)
  - `allowRemoteImages` (boolean, default false; when true, remote images are downloaded into `assets/`)
  - `fontCssUrls` (string or array of strings, optional external font stylesheets)
  - Theme assets can live under `$VAULT/.blog/theme/` (icons, fonts, optional `fonts.css`).
  - All other settings use defaults in code.

## Frontmatter Schema (Fail‑Fast)
Only files with `blog_publish: true` are published. Missing `blog_publish` means **ignore file** (do not error).

Required for `blog_publish: true`:
- `blog_title`: string
- `blog_date`: date (YYYY‑MM‑DD)
- `blog_lang`: `"zh"` or `"en"`
- `blog_translation_key`: slug/path string
- `blog_category`: non‑empty list of strings
- `blog_excerpt`: string

Optional:
- `blog_cover_image`: local path or supported image source

Rules:
- **No zh/en pairing requirement**. A post can exist in only one language.
- **Language switcher** shows only if an alternate language exists for the same `blog_translation_key`.
- `blog_aliases` is not used.

## File/Folder Scanning
- Recursively include `*.md` in the vault.
- Ignore directories starting with `.` (e.g. `.obsidian`, `.trash`) and `node_modules`.

## Obsidian Compatibility
Supported transformations:
- **Comments**: strip Obsidian `%% ... %%` (inline and multi‑line) + HTML comments `<!-- ... -->`.
- **Callouts**:
  - `<aside> ... </aside>` is converted to a callout block.
  - Rendered as a blockquote with a **light background** (dark mode supported).
- **Image embeds**: `![[image.png]]` resolves by path or filename.

Non‑goals (current version):
- Full Obsidian wikilink resolution for `[[Note]]` is not required.

## Media Handling
Supported image sources:
- Local `.jpg/.jpeg/.png` inside the vault
- Base64 `data:` URIs for PNG/JPEG
- Remote HTTP(S) PNG/JPEG (fetched and re‑written when `allowRemoteImages` is true)

Processing rules:
- Generate **WebP + fallback** (JPG/PNG).
- Target size ≤ 600 KB by resizing down to a minimum width (and max width cap).
- Default max width ~680 px; min width ~480 px.
- Do **not** modify source images in the vault.
- Copy processed assets into output `assets/`.

## Output Structure
- Each post generates its own HTML at `/<translation_key>/` (SEO friendly).
- List page shows **all posts** (no pagination), grouped into **year sections** (e.g., 2025, 2024, 2023).
- JSON index for filters is generated.
- RSS feeds at `/rss.xml` and `/rss-<lang>.xml` are generated when `siteUrl` is set.

If output contains `.git`, `CNAME`, or `.nojekyll`:
- Build into a temp directory and **sync** into output, preserving repo metadata.

## UI/UX Requirements
- **Dark mode** with auto/light/dark toggle (keep existing demo behavior).
- **Sticky navbar** (always visible while scrolling).
- **TOC**:
  - Generated from headings (H1–H4).
  - Left sidebar on desktop; collapsible on mobile.
  - Anchors must account for sticky nav (no top overlap).
- **Filters**:
  - Category filters apply to **all posts**.
  - A post can appear in multiple categories.
- **Home card density**: compact layout; avoid excessive whitespace.
- **No back button** on article pages (removed).

## Markdown Rendering Features
- **Code highlighting** (fenced code blocks, language‑aware).
- **Math** support:
  - Inline: `$...$`
  - Block: `$$...$$`
- **Callout blocks** (from `<aside>` conversion).
- **Blockquotes** styled with a subtle border and background.

## SEO
- Per‑post HTML with `canonical`, `og:*`, and `meta description`.
- `hreflang` for language variants when both exist.

## Validation / Commands
Primary command:
```
npm run generate -- <vaultDir> <outputDir>
```

Quality baseline (optional):
```
node .codex/skills/gen-blog-quality-baseline/scripts/quality_baseline.js --dist dist
```

## Non‑Goals / Deferred
- Full Obsidian wikilink graph resolution
- Interactive SPAs for posts (static pages preferred for SEO)
- Custom tag system beyond `blog_category`
