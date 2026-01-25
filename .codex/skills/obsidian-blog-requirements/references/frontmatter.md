# Frontmatter Requirements

## Required Fields (Published Posts)

All published posts must include:

- `blog_publish`: `true` or `false` (only `true` is published; missing means ignored)
- `blog_title`: string
- `blog_date`: ISO date string (`YYYY-MM-DD` recommended)
- `blog_lang`: `zh` or `en` (accepts `zh-*` or `en-*` and normalizes)
- `blog_translation_key`: slug/path in lowercase, `a-z0-9` and `-` only
- `blog_category`: non-empty list of strings
- `blog_excerpt`: string

Optional:

- `blog_cover_image`: local path, external URL, or data URI

Notes:

- If `blog_publish: false`, the post is excluded and other fields are not required.
- `blog_category` allows multiple categories. The first item is used as `primaryCategory` in output.

## Image Sources

Allowed image sources (for `blog_cover_image` and Markdown images):

- Local files anywhere in the vault (relative paths preferred)
- External URLs (`https://` or `http://`)
- Data URIs (`data:image/...;base64,...`)

The generator copies/normalizes images into `dist/assets` (WebP + compressed fallback) without modifying sources.

## Translation Key Format

Valid examples:

- `digital-minimalism`
- `design/quiet-interfaces`
- `operations/night-shift-notes`

Invalid examples:

- `Design/Quiet Interfaces` (uppercase + spaces)
- `notes/2026 01 05` (spaces)
- `notes/你好` (non-latin characters)

## About Page

Use `blog_translation_key: about`. If missing, the About link falls back to home.

## Example (Minimal)

```yaml
---
blog_publish: true
blog_title: Notes from the Night Shift
blog_date: 2026-01-05
blog_lang: en
blog_translation_key: operations/night-shift-notes
blog_category:
  - Operations
  - Team
blog_excerpt: A short log of what breaks after hours and the habits that keep us steady.
blog_cover_image: assets/images/night-shift.jpg
---
```
