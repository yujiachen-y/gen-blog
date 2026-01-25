# Troubleshooting

## Common Errors and Fixes

- `missing blog_publish`
  - Add `blog_publish: true` (or `false` if you want to exclude the note).

- `blog_publish must be true or false`
  - Use a boolean, not a string.

- `missing blog_title`
  - Provide a non-empty title.

- `invalid blog_date`
  - Use a parseable date (recommended `YYYY-MM-DD`).

- `invalid blog_lang (must be zh or en)`
  - Set `blog_lang` to `zh` or `en` (or `zh-*`, `en-*` which are normalized).

- `invalid blog_translation_key (use slug/path)`
  - Use lowercase slug/path with `a-z0-9` and `-` only.

- `blog_category must be a non-empty list`
  - Provide a YAML list with at least one category.

- `missing blog_excerpt`
  - Add a short summary string.

## Image Source Tips

- Prefer relative paths for local files.
- For external URLs, ensure the link is reachable and stable.
- For data URIs, ensure the MIME type matches the content (e.g., `data:image/png;base64,...`).
