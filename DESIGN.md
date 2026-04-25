# Design system — yujiachen.com

Working spec. Tokens, faces, components, motion. Companion to `PRODUCT.md`.

## Color

**Strategy: Restrained.** One ink, used deliberately. Background tinted warm (cream/paper), ink tinted cool (indigo). The contrast is the point — ink on paper.

All values in OKLCH. Never pure `#000` / `#fff` — every neutral carries a hint of warmth.

### Light (default)

| Token           | Value                        | Use                                 |
| --------------- | ---------------------------- | ----------------------------------- |
| `--bg`          | `oklch(98% 0.006 85)`        | Page background (warm cream)        |
| `--surface`     | `oklch(99.5% 0.004 85)`      | Subtle inset surfaces (code, input) |
| `--ink`         | `oklch(42% 0.11 255)`        | Accent — links, mark, indicators    |
| `--ink-soft`    | `oklch(42% 0.11 255 / 0.10)` | Accent fills, current-state bg      |
| `--text`        | `oklch(22% 0.012 80)`        | Body text (warm near-black)         |
| `--text-muted`  | `oklch(48% 0.008 80)`        | Metadata, secondary                 |
| `--text-faint`  | `oklch(64% 0.005 80)`        | Tertiary, placeholders              |
| `--rule`        | `oklch(22% 0.012 80 / 0.12)` | Hairlines (the structural element)  |
| `--rule-strong` | `oklch(22% 0.012 80 / 0.22)` | Heavier dividers (year markers)     |
| `--callout-bg`  | `oklch(95% 0.012 85)`        | Aside / callout background          |

### Dark

| Token           | Value                        | Use                               |
| --------------- | ---------------------------- | --------------------------------- |
| `--bg`          | `oklch(15% 0.008 255)`       | Page background (deep ink-tinted) |
| `--surface`     | `oklch(18% 0.010 255)`       | Subtle inset surfaces             |
| `--ink`         | `oklch(74% 0.09 255)`        | Accent (lifted for dark)          |
| `--ink-soft`    | `oklch(74% 0.09 255 / 0.18)` | Accent fills                      |
| `--text`        | `oklch(94% 0.006 85)`        | Body text                         |
| `--text-muted`  | `oklch(70% 0.008 85)`        | Metadata, secondary               |
| `--text-faint`  | `oklch(52% 0.006 85)`        | Tertiary                          |
| `--rule`        | `oklch(94% 0.006 85 / 0.14)` | Hairlines                         |
| `--rule-strong` | `oklch(94% 0.006 85 / 0.24)` | Heavier dividers                  |
| `--callout-bg`  | `oklch(20% 0.012 255)`       | Aside / callout background        |

### Categories

Drop multicolor dots. Categories are typographic — small caps, sans, `--text-muted`. The active filter uses `--ink-soft` background and `--ink` text. No per-category color.

## Typography

Two families. Serif for reading (body, post titles, year markers). Sans for chrome (nav, metadata, dates, code labels, UI). Mono for code.

```css
--font-serif:
  'Source Serif 4', 'Iowan Old Style', 'Charter', 'Source Han Serif SC', 'Noto Serif CJK SC',
  'Songti SC', Georgia, serif;
--font-sans:
  'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB',
  'Noto Sans CJK SC', sans-serif;
--font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
```

The vault's `.blog/theme/fonts.css` may override `--font-serif` / `--font-sans` to load custom @font-face. If absent, system stacks above are sufficient.

### Type scale

Ratio 1.25, base 17px (a touch larger than 16 — reading-first).

| Token         | px / line-height | Role                                          |
| ------------- | ---------------- | --------------------------------------------- |
| `--t-display` | 56 / 1.05        | Year markers (sans, weight 600, tabular nums) |
| `--t-h1`      | 38 / 1.15        | Post title                                    |
| `--t-h2`      | 26 / 1.25        | Section heading (in body)                     |
| `--t-h3`      | 20 / 1.35        | Sub-section                                   |
| `--t-body`    | 17 / 1.65        | Body                                          |
| `--t-meta`    | 14 / 1.4         | Metadata, dates, captions (sans, 480 weight)  |
| `--t-micro`   | 12 / 1.3         | Small caps, kicker, nav (sans, 600, tracked)  |

Body line length: max 68ch.

## Layout

- `--page-max`: `min(720px, 92vw)` for body content.
- `--page-wide`: `min(960px, 96vw)` for the list and nav.
- Single-column. Sidebars only on desktop ≥1100px (TOC); below that, TOC collapses to a top affordance.
- No card frame around the page. Background and rules carry the structure.

## Spacing

8px base, geometric:

```
--s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
--s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 72px; --s-9: 112px;
```

Vertical rhythm anchors on `--s-5` (24px) — paragraphs, list rows.

## Elevation

**Flat.** No shadows for elevation. Use:

- Hairlines (`--rule`) for structure.
- `--callout-bg` and `--surface` for inset.
- A single 1px `--rule-strong` border for the language toggle and Ask AI input.

The only shadow allowed: `0 1px 0 var(--rule)` as a subtle bottom-border on the sticky nav, **only** when the page has scrolled (state class).

## Motion

- Duration: `150ms` (micro), `220ms` (state), `360ms` (page entrance).
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo).
- Animate `opacity`, `transform`, `color`, `background-color`. Never `width` / `height` / layout properties.
- Respect `prefers-reduced-motion: reduce` — drop to `1ms` and disable transforms.

## Components (visual contract)

### Wordmark

`Jiachen Yu` set in serif, weight 500, slightly tracked (-0.005em). Color shifts to `--ink` on hover. No mark; the typography carries the brand.

### Nav

`[mark + wordmark] · · · [Blog] [About] · · · [search] [EN | 中文] [theme] [Ask AI]`

- Sticky, transparent until scroll, then `--rule` bottom hairline appears.
- Height 64px desktop, 56px mobile.
- Items in `--t-micro` (small caps, sans). No pill backgrounds. Active state: ink-blue color + 2px ink underline (offset 6px from baseline).
- Mobile: collapses to `[mark] [search-icon] [hamburger]`. Hamburger opens a full-screen sheet with all nav items stacked.

### List page

- Year markers: `--t-display` numerals, sans, full-width hairline directly below.
- Each post row: serif title (`--t-h3`, weight 500) on left, sans date (`--t-meta`, `MM·DD`) right, hairline `--rule` between rows.
- No bullet dots. The hairline carries the row.
- Hover: row gets `--ink-soft` background, full-bleed within content column. Title color → `--ink`. Underline appears on title.
- Filter pills: text + small caps. Active = `--ink-soft` bg + `--ink` text + 1px `--rule-strong` border. Inactive = `--text-muted`. No pill bg on inactive.
- Search: 1px `--rule-strong` outline, no fill.

### Post page

- Single header block: kicker line (`YYYY · MM · DD · CATEGORY` in `--t-micro`), then `--t-h1` title in serif. **No duplicate H1** — the markdown's first H1 is suppressed when it matches the frontmatter title.
- TOC: left sidebar at ≥1100px, collapsed disclosure at top below 1100px.
- Body: serif, `--t-body`, max 68ch.
- Inline links: ink-blue, no underline, 1px ink-blue bottom border (text-decoration-skip).
- Aside / callout: warm `--callout-bg`, full hairline `--rule` border (no side stripe), 24px padding.
- Code blocks: `--surface` bg, mono, no rounded corners — square edges, hairline border. Inline code: `--surface` bg, 2px horizontal padding, no border.
- Blockquotes: serif italic, indented 24px, ink-blue mark `❝` at start (CSS `::before`), no left stripe.
- Artifact banner (e.g., "Open slides"): full hairline-bordered row, sans label left, arrow right. No card shadow.

### Ask AI

Side door, not centerpiece. Visual contract:

- No gradient text. Page title set as a normal post-style header: kicker `ASK · AI`, h1 in serif `Ask anything about my writing.`
- Single input field, hairline-bordered, full content width. `Ask` button merges into the right edge of the input — same height, ink-blue text, no fill until hover.
- Drop the suggestion chips. Replace with one line of plain text: _"Or copy a prompt for [ChatGPT] [Claude] [Gemini]"_ — text links, ink-blue, no pill bg.
- Prompt panel: collapsed by default, opens to a `--surface` block with mono pre.
- Match the blog's serif voice. No "AI startup" elements.

### About page

- Two-column at desktop ≥900px: article body left (max 60ch), `Connect` block right (sans, hairline-bordered top + bottom only, no card).
- Below 900px: stacked, Connect drops below article.

## Mobile rules

- Test at 360 / 390 / 414. The 1440 layout never compromises mobile.
- Nav collapses to mark + hamburger + search-icon by 720px.
- TOC collapses to a top disclosure by 1100px.
- Content padding: `clamp(16px, 5vw, 32px)` horizontal.
- All hover states have keyboard-focus equivalents (`--ink` outline, 2px offset).

## Accessibility

- Body contrast ≥7:1 (AAA). `--text` on `--bg` should hit this in both themes — verify before shipping.
- `--ink` on `--bg` ≥4.5:1 (AA). Verify.
- Focus ring: 2px `--ink`, 2px offset, never removed.
- `prefers-reduced-motion`: respected.
- `prefers-color-scheme`: respected unless user has chosen explicitly (persisted in `localStorage`).

## Routing additions (informs templates)

- `/` redirects (client-side, JS) to `/blog/` or `/zh/blog/` based on `navigator.language`. Persists choice in `localStorage` after first visit so subsequent loads to `/` honor the user's last preference.
- `/about/` becomes the only route for About (currently both `/` and `/about/` serve it).
- Old `/` deep links: `<meta http-equiv="refresh">` fallback for no-JS cases, defaulting to `/blog/`.
