# Remediation Guide

Use this when the baseline script reports warnings or failures.

## Missing covers

- Ensure `coverImage` points to a file that exists under `assets/`.
- Keep paths relative (no leading slash) so GitHub Pages subpaths work.

## Oversized cover images

Goal: keep covers **<= 1800 KB** (prefer 500–1200 KB).

- **Resize** images to a smaller dimension (e.g., max 1920px wide for cover images, 1080px for inline images).
- **Compress** after resizing; prefer JPEG for photos, PNG for flat graphics.

Example (macOS, keeps PNG but reduces size):

```
sips -Z 900 assets/images/cover-silence.png
```

Example (convert to JPEG):

```
sips -s format jpeg -s formatOptions 80 assets/images/cover-silence.png --out assets/images/cover-silence.jpg
```

Then update frontmatter:

```
coverImage: assets/images/cover-silence.jpg
```

## posts/index.json too large (> 2 MB)

- Load fewer posts on the home view (e.g., latest 100).
- Split `posts/index.json` by year or pagination.
- Move large excerpts to detail JSON only.

## Home payload too large (> 1 MB)

- Reduce `posts/index.json` size (above).
- Avoid large inline HTML in index.
- Compress cover images.

## Dist size too large (> 50 MB)

- Remove unused assets.
- Compress images.
- Move heavy assets to a CDN if needed.
