# Blog Generator V1 Design

## Summary

This document specifies the V1 plan for turning the current demo into an Obsidian-powered static blog generator. V1 follows a **Fail-Fast + Minimal Viable** approach, prioritizes **static HTML for SEO**, and keeps **full-list filtering + existing UI animations** via a lightweight client index. All implementation work will start after this document is reviewed.

## Goals

- Generate static HTML posts and paginated lists suitable for GitHub Pages (`user.github.io`).
- Support bilingual content (zh/en) with UI language switch and dark mode preserved.
- Provide full-list filtering in the UI without losing current filter animations.
- Enforce strict frontmatter validation (fail fast on missing or invalid blog fields).
- Normalize and compress images in the generated output (do not modify source files).

## Non-goals (V1)

- Wikilink support is optional and not required in V1.
- Advanced taxonomy pages (tag archives, series pages) are out of scope.
- LFS or external CDN integration is out of scope for V1.

## Success Criteria (V1)

- Generator produces **static posts** and **paginated list pages** (page size = 12).
- UI supports **zh/en switch** and **dark mode** (existing behavior preserved).
- SEO basics are included for each post page.
- Full-list filtering works across all posts with existing animation style.

## Development Workflow

- Work will happen on a dedicated feature branch (name TBD by coordinator).
- Design doc is authored first (this file), then reviewed by the user.
- Implementation will be split into milestones, each with a small commit to trigger pre-commit checks.
- Run `gen-blog-quality-baseline` at major milestones to catch regressions.
- Use subagents for parallel tasks; coordinator reviews and merges.

## Content Model

### Required Frontmatter (Fail-Fast)

```yaml
blog_publish: true
blog_title: ...
blog_date: 2024-12-01
blog_lang: zh | en
blog_translation_key: design/quiet-interfaces
blog_category:
  - Design
blog_excerpt: ...
```

### Optional Frontmatter

```yaml
blog_cover_image: assets/images/xxx.jpg
```

### Validation Rules

- Missing required fields -> **error**.
- `blog_lang` must be `zh` or `en` -> **error**.
- `blog_translation_key` must be unique across all posts -> **error**.
- `blog_category` must be a non-empty array of strings -> **error**.
- `blog_excerpt` must be non-empty -> **error**.
- `blog_publish` must be `true` to include in output; all others ignored.

### About Page

- A post with `blog_translation_key: about` is treated as the about page.
- About still uses the same required frontmatter schema.
- It is excluded from list pagination but exposed at `/about/` and `/about/en/`.

## Input Scanning

- Input root is provided via CLI args: `npm run generate -- <vaultDir> <outputDir>`.
- Scan all Markdown files under the vault except ignored paths.

### Default Ignore Paths

- `.obsidian/`
- `.trash/`
- any hidden folders starting with `.`

## Output Structure

- Output directory defaults to `dist/` unless CLI overrides.
- Static post pages use `blog_translation_key` as path.

Example:

```
/dist
  /index.html
  /page/2/index.html
  /about/index.html
  /about/en/index.html
  /design/quiet-interfaces/index.html
  /design/quiet-interfaces/en/index.html
  /assets/...
  /posts/filter-index.json
  /sitemap.xml
  /robots.txt
```

## Pagination

- Page size: **12 posts**.
- Home list pages are static HTML:
  - `/index.html` (page 1)
  - `/page/2/index.html` (page 2)
  - ...
- Sorting: descending by `blog_date`, tie-breaker by `blog_translation_key`.
- Pagination UI appears on list pages; hidden when filtering is active.

## Filtering (Full List)

- Generate a lightweight filter index (JSON) containing only minimal fields:
  - `translation_key`, `lang`, `title`, `date`, `categories`, `excerpt`, `cover_image`.
- Client loads this index once and filters across **all posts**.
- Filtering remains client-side to preserve the demo’s animation style.

## SEO (V1)

### Post Pages

- `<title>` uses `blog_title`.
- `meta description` uses `blog_excerpt`.
- `canonical` points to the post URL.
- `hreflang` links the zh/en pair.
- OG/Twitter meta uses cover image if available.

### Site Files

- `sitemap.xml` includes all post pages, list pages, and about pages.
- `robots.txt` points to sitemap.

## Markdown Rendering

- Use `markdown-it` with plugins for common Markdown features.
- Obsidian-specific features (wikilink/embed/callout) are not required in V1.
- If `[[...]]` patterns are detected, behavior should be either:
  - Fail fast, or
  - Render as plain text (to be decided during implementation).

## Image Pipeline

### Rules

- **Never modify source images**.
- All transformations happen in `dist/assets/`.
- `maxWidth = 2000px` (resize if wider).

### Output Formats

- JPG -> WebP (lossy, quality=80) + JPG fallback (quality=80).
- PNG -> WebP (lossless) + PNG fallback (lossless optimize).

### HTML Output

Use `<picture>` for compatibility:

```html
<picture>
  <source srcset="/assets/foo.webp" type="image/webp" />
  <img src="/assets/foo.jpg" alt="..." />
</picture>
```

### CSS Display Rules

- Apply max-height constraints for **all article images**.
- Use viewport-based limits (desktop `max-height: 40vh`, mobile `max-height: 50vh`).

## UI Requirements

- Preserve current zh/en toggle behavior.
- Preserve dark mode switcher.
- Filtering animation should remain consistent with the demo (client-side filtering).

## Implementation Milestones

1. **Design Doc** (this file)
2. **Generator Core**: frontmatter schema + pagination output
3. **Markdown-it Pipeline**: replace marked
4. **Image Pipeline**: WebP + fallback + resize
5. **Filter Index + UI wiring**
6. **SEO Files**: sitemap + robots + meta tags
7. **Test Data**: add `dump-markdown/` samples
8. **Baseline**: run gen-blog-quality-baseline

Each milestone produces a small commit and runs pre-commit hooks.

## Risks

- Filter index size may grow with many posts (monitor with baseline).
- Full-list filtering may be slower on low-end devices if index grows large.
- Image pipeline introduces heavier dependencies (build time).

## Open Questions (to finalize at implementation)

- Behavior when `[[...]]` is found in markdown in V1.
- Exact list of markdown-it plugins to include.
- Final URL scheme for language directories (e.g., `/en/` vs `/zh/`).

