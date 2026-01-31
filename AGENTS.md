# Repository Guidelines

## Project Structure & Module Organization

- `scripts/` contains the generator entrypoint (`scripts/generate.js`). It reads Markdown and produces `dist/` output.
- `theme/` holds the SPA shell (`theme/index.html`, `theme/app.js`) and the shared style sheet (`theme/styles.css`).
- `assets/` stores local images and other static assets referenced by frontmatter (e.g., `assets/images/cover-example.png`).
- `.codex/skills/` contains repo skills, including `gen-blog-quality-baseline` for output quality checks.
- `dist/` is generated output and is ignored by git; don’t edit it manually.
- `.sample-markdown/` is for local demos only and is ignored by git.

## Build, Test, and Development Commands

- `npm run generate -- <markdownDir> dist` — generate the SPA output and JSON data into `dist/`.
- `npm run lint` — run ESLint for JS files.
- `npm run format` — format code with Prettier.
- `npm run format:check` — verify formatting without modifying files.

## Coding Style & Naming Conventions

- JavaScript uses 2-space indentation, single quotes, and trailing commas where supported (Prettier enforced).
- Filenames are lowercase with hyphens for assets (e.g., `assets/images/quiet-interfaces.jpg`).
- Frontmatter fields: `title`, `date`, `category`, `excerpt`, `coverImage` (relative path under `assets/`).

## Testing Guidelines

- No test framework is configured yet.
- Use the baseline skill to validate output quality:
  - `node .codex/skills/gen-blog-quality-baseline/scripts/quality_baseline.js --dist dist`

## Commit & Pull Request Guidelines

- Commits follow Conventional Commits format.
- Keep commits focused: generator changes separate from content/asset changes.
- PRs should include:
  - A summary of user-visible impact (layout, performance, asset sizes).
  - Notes on any threshold changes or new assets.
  - Screenshots or a local preview URL when visual changes are made.

## Agent-Specific Notes

- Pre-commit runs `lint-staged`; fix lint/format issues before committing.
- Avoid committing `dist/` and `.sample-markdown/` content.
