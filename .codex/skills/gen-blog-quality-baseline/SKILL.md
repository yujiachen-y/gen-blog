---
name: gen-blog-quality-baseline
description: Evaluate gen-blog output quality and regression risk by measuring dist size, posts index size, home payload, and cover image sizes. Use when reviewing generated static output (dist/) for performance or content degradation, especially after adding many posts or assets.
---

# Gen Blog Quality Baseline

## Overview

Run a lightweight quality check against `dist/` after `npm run generate` to spot early regressions in payload size, HTML growth, and image bloat.

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
  --max-home-kb 1024 \
  --max-total-mb 50 \
  --max-cover-kb 600 \
  --max-html-mb 15 \
  --max-page-kb 400
```

Use JSON output for machine parsing:

```
node .codex/skills/gen-blog-quality-baseline/scripts/quality_baseline.js --dist dist --json
```

### 3) Interpret results

- **Failures** indicate hard regressions (e.g., missing `index.html`, oversized post index).
- **Warnings** indicate growing performance risk (home payload, HTML total, oversized images).
- Use the thresholds as a starting point; tune once real usage data is available.

### 4) Fix warnings quickly

Avoid persistent warnings to prevent alert fatigue. See `references/remediation.md` for common fixes.

## Resources

### scripts/
- `scripts/quality_baseline.js`: Computes size metrics and validates thresholds.

### references/
- `references/thresholds.md`: Recommended baseline thresholds and scaling guidance.
- `references/remediation.md`: Common fixes to clear warnings.
