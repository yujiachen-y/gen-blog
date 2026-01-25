---
name: obsidian-blog-requirements
description: Requirements and validation rules for Obsidian notes that feed the gen-blog generator. Use when preparing an Obsidian vault for blog generation, diagnosing frontmatter validation errors, or explaining the required blog_* fields, assets layout, and zh/en pairing rules.
---

# Obsidian Blog Requirements

## Overview

Use this skill to validate Obsidian notes for gen-blog. It defines the required frontmatter, zh/en pairing, assets rules, and the fail-fast behaviors the generator enforces.

## Quick Workflow

1. Confirm the vault path and run `npm run generate -- <vaultDir> dist`.
2. If generation fails, map errors to fixes using `references/troubleshooting.md`.
3. Ensure every published post meets the frontmatter and assets rules in `references/frontmatter.md`.

## Core Rules (Summary)

- **Filter rule:** A note is included only when `blog_publish: true`. Missing `blog_publish` is an error.
- **Required fields for published posts:** `blog_title`, `blog_date`, `blog_lang`, `blog_translation_key`, `blog_category`, `blog_excerpt`.
- **Language pairing:** Every `blog_translation_key` must have both `zh` and `en` posts.
- **Translation key format:** Lowercase slug or path (`a-z0-9` + `-`), no spaces; see examples in `references/frontmatter.md`.
- **Categories:** `blog_category` is a non-empty list; multiple categories are allowed; first item is used as `primaryCategory` in output.
- **About page:** Use `blog_translation_key: about` and provide both `zh` and `en`.
- **Assets:** Only local images under `<vault>/assets/` are allowed; external URLs are rejected.
- **Image formats:** `.jpg`, `.jpeg`, `.png` only. Generator emits WebP + compressed fallback into `dist/assets` and does not modify sources.

## References

- `references/frontmatter.md` - Required fields + example frontmatter
- `references/troubleshooting.md` - Error messages and fixes
