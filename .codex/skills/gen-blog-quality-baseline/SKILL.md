---
name: gen-blog-quality-baseline
description: Evaluate gen-blog output quality and regression risk by measuring dist size, posts index size, home payload, and cover image sizes. Use when reviewing generated static output (dist/) for performance or content degradation, especially after adding many posts or assets.
---

# Gen Blog Quality Baseline

## Overview

Run a lightweight quality check against `dist/` after `npm run generate` to spot early regressions in payload size, post index growth, and cover image bloat.

## Workflow

### 1) Generate the site

Run the generator first to produce `dist/`.

```
npm run generate -- <markdownDir> dist
```

### 2) Run the baseline script

Use the bundled script. Defaults match the recommended thresholds in `references/thresholds.md`.

```
node .codex/skills/gen-blog-quality-baseline/scripts/quality_baseline.js --dist dist
```

Optional overrides:

```
node .codex/skills/gen-blog-quality-baseline/scripts/quality_baseline.js \
  --dist dist \
  --max-index-mb 2 \
  --max-home-kb 1024 \
  --max-total-mb 50 \
  --max-cover-kb 600
```

Use JSON output for machine parsing:

```
node .codex/skills/gen-blog-quality-baseline/scripts/quality_baseline.js --dist dist --json
```

### 3) Interpret results

- **Failures** indicate hard regressions (e.g., missing `posts/index.json`, oversized index).
- **Warnings** indicate growing performance risk (home payload, total dist size, oversized covers).
- Use the thresholds as a starting point; tune once real usage data is available.

## Resources

### scripts/
- `scripts/quality_baseline.js`: Computes size metrics and validates thresholds.

### references/
- `references/thresholds.md`: Recommended baseline thresholds and scaling guidance.
