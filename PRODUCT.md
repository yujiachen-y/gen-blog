---
register: brand
---

# yujiachen.com

Personal site of Jiachen Yu. The output of `gen-blog`: a static, bilingual (zh/en) blog rendered from an Obsidian vault. Design _is_ the product — every reader sees the same surface and forms an impression of the writer from it.

## Users

- **Primary — engaged readers.** Engineers, PMs, designers, writers who arrive via a specific essay link. They came to read; the site must not get in the way.
- **Secondary — first-time visitors.** Came from search, a Twitter/小红书 mention, or a referral. Five seconds to decide "is this person serious?" and "do I want to come back?"
- **Tertiary — future-Jiachen.** Returns to reread, find a quote, link a friend. Wants the index to feel like a working notebook he keeps adding to.

## What this site is (and is not)

- **Is**: a personal essay/notebook surface. Long-form, bilingual, considered. Posts are the artifact; everything else is in service of them.
- **Is not**: a portfolio, a SaaS landing page, an AI product, a CV. No conversion funnel. No CTAs that aren't "read this post."

## Voice

_A working notebook, deeply considered._ Sharper than the typical Hugo theme. Composed minimalism — every element is there for a reason. Marginalia and printer's-ink vocabulary, not Material Design. Bilingual parity: 中文 and English get equal craft.

## Strategic principles

1. **Reading is the spine.** Typography sets the rhythm; layout, color, and chrome respect it.
2. **One ink, used boldly.** A single chromatic accent (ink-blue). Categories, links, marks, current-state — all draw from the same well.
3. **Quiet by default, surprising in moments.** Year markers, post openings, the personal mark, the language toggle — these are where craft shows. Everything else stays out of the way.
4. **Bilingual parity.** Default landing routes by browser locale; both languages render with equal typographic care; switcher is always one click away.
5. **Side doors stay quiet.** Ask AI, RSS, GitHub — useful but not loud. They match the blog's voice, not their respective categories' clichés.
6. **Mobile is first-class.** Today the nav collapses on phones. In the redesign, mobile is a designed state, not a casualty.

## Anti-references

- **Generic AI-startup aesthetic.** Gradient text, big "Ask anything" hero with suggestion chips, dot-prefixed pill buttons. The current Ask AI page leans this way and reads as borrowed.
- **Floating-card-on-grey pattern.** Pages framed by a faint outline floating in `#f7f7f7`. Reads as unfinished container, not intentional surface.
- **Side-stripe callouts** (`border-left: 4px solid`). Bookish in concept, banal in execution.
- **Multicolor category dots.** Five hues × low saturation = visual noise, no semantic gain.
- **Pill-button-for-everything.** Same shape for nav, filter, language, brand link — flattens hierarchy.

## Anti-patterns to refuse

- Dark mode as default — this is a reading surface, daylight first.
- Card-based home/list patterns — hairlines and rhythm carry the structure.
- "Modern" AI-product hero language ("Ask anything", "Powered by", "One-click") — replace with site-native voice.
- Em dashes in copy.

## What a redesign must achieve

- One coherent visual language from `/blog/` to `/about/` to `/ask-ai/` to a long post.
- Mobile nav and filter strip that work at 360px.
- Bilingual default routing and a real EN | 中文 toggle.
- A signature element (mark + treatment of year markers) so the site is recognizably _this person's_.
- Drop the absolute bans: gradient text, side-stripe borders, floating cards.
