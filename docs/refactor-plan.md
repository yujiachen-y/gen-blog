# Gen Blog Refactor Plan

## Goals
- Reduce maintenance cost by splitting large files into focused modules.
- Add guardrails (max file/function size, complexity) without blocking day-to-day work.
- Improve determinism and resilience in generation (ordering, remote fetches).
- Preserve current architecture (no new build step; keep `scripts/` + `theme/` boundaries).

## Scope
- Generator: `scripts/generate.js` and its helpers (`scripts/images.js`, `scripts/markdown.js`).
- Frontend runtime: `theme/app.js`.
- Lint/pre-commit rules.

## Constraints
- Minimal diffs per phase; avoid new env vars/config.
- Keep generated output behavior stable unless explicitly changing it.
- Do not touch `dist/` (generated).

## Proposed Tasks

### Phase 0 — Decisions
- [x] Confirm whether Markdown `~~` should remain as strikethrough or be stripped as Obsidian deletions. (Decision: strip as Obsidian deletions.)
- [x] Decide policy for remote image failures (fail build vs soft-fail with warning). (Decision: fail build.)

### Phase 1 — Safety & Determinism
- [x] Sanitize `PAGE_DATA` JSON injection (`</script>` guard; escape `<` as `\u003c`).
- [x] Make language order deterministic (stable sort before choosing `defaultLang` and list pages).
- [x] Add fetch timeout + max size guard for remote images (abort + clear error message).
- [x] Introduce a small concurrency limiter for image processing to avoid OOM spikes.

### Phase 2 — Generator Modularization
- [x] Extract Obsidian preprocessing (asides/comments/deletions/embeds) into `scripts/obsidian.js`.
- [x] Extract RSS helpers into `scripts/rss.js`.
- [x] Extract template rendering helpers into `scripts/templates.js`.
- [x] Extract page assembly into `scripts/pages.js` (post/list HTML + `PAGE_DATA`).
- [x] Extract asset copying into `scripts/assets.js`.
- [x] Keep `scripts/generate.js` as orchestration only.

### Phase 3 — Frontend Modularization
- [ ] Split `theme/app.js` into ES modules (no bundler):
  - [x] `theme/app/state.js` (state, storage keys, helpers)
  - [x] `theme/app/filters.js` (filters + search)
  - [x] `theme/app/toc.js`
  - [x] `theme/app/comments.js`
  - [x] `theme/app/theme.js` (theme + language toggles)
- [x] Keep `theme/app.js` as a small init/compose file.

### Phase 4 — Quality Gates
- [x] Add ESLint rules: `max-lines`, `max-lines-per-function`, `complexity`, `max-depth`, `max-statements`.
- [x] Start as `warn`, with per-file overrides for current large files.
- [x] After splits, tighten thresholds and upgrade to `error`.
- [x] Optionally make lint-staged fail on warnings (`eslint --max-warnings=0`) after thresholds stabilize.

## Validation
- [ ] `npm run generate -- "/Users/yujiachen/Library/Mobile Documents/iCloud~md~obsidian/Documents/jiachen yu" ../yjc567.github.io`
- [ ] Agent-browser verification of output (post/list load, filters/search, theme/lang toggle, comments render).
- [ ] Optional: `npm run lint`
- [ ] Optional: `npm run format:check`
- [ ] Optional: `node .codex/skills/gen-blog-quality-baseline/scripts/quality_baseline.js --dist dist`

## Out of Scope (for now)
- Full TypeScript migration (can revisit after modularization).
- UI/UX redesigns.
- New build tooling or bundlers.

## New Findings
- Remote image fetch guard uses internal defaults (timeout 10s, max 8MB) rather than new user config.
- Image processing concurrency is capped to a CPU-based range (min 2, max 6) to reduce OOM spikes.
- Generator helpers were split further into focused modules (`scripts/fs-utils.js`, `scripts/paths.js`, `scripts/content.js`, `scripts/image-index.js`, `scripts/asset-resolver.js`, `scripts/markdown-renderer.js`) to keep `scripts/generate.js` primarily orchestration.
- Theme runtime is now split into `/app/*.js` modules; `copyThemeAssets` now copies the `theme/app` directory into `dist/app`.
