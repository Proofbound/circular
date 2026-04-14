## Visual Style Guide

**Last Updated**: April 2026

The Circular's visual identity draws on Victorian periodical design — not as costume, but as a deliberate contrast to the saturated, image-heavy, algorithmically-optimized media our readers swim in every day. Every design choice should pass one test: *does this make us look more like The Spectator (est. 1828) or more like a Substack?* If the answer is Substack, reconsider.

### Masthead

The publication title is **The Fortnightly Circular** — no "Karam & Sprague's" prefix. The full subtitle line is: *Conducted for the Benefit of Persons of Discernment & Enquiring Disposition*. Below that: volume, issue number, and date.


### Color Palette

Strictly limited. No full-color photography. No gradients. No colored backgrounds on content areas.

```css
:root {
  --color-ink:       #1a1a1a;   /* near-black, headlines, masthead */
  --color-text:      #2d2d2d;   /* body copy */
  --color-muted:     #6b6b6b;   /* bylines, dates, captions, nav */
  --color-rule:      #c4b5a0;   /* horizontal rules, borders — warm sepia-gray */
  --color-accent:    #8b3a3a;   /* ONE accent only: muted oxblood/burgundy */
  --color-paper:     #faf8f5;   /* warm off-white page background */
  --color-highlight: #f0ebe3;   /* pull-quote bg, sidebar bg, subtle highlight */
}
```

Rules for `--color-accent`:
- Used ONLY for: drop caps, linked article titles on hover, the masthead title, and occasional decorative rule lines.
- Never for backgrounds, buttons, banners, or large filled areas.
- Never introduce a second accent color. One color plus black is the entire chromatic range.

### Typography

Typography does the work that photography does for other publications. The lead headline IS the visual anchor of the front page.

**Display / Headlines** — a high-contrast serif with visible stroke contrast and sharp serifs. Must feel intentional and slightly eccentric, not generic. Candidates (in preference order): Playfair Display, Cormorant Garamond, or any Scotch Modern with a Display weight. Fallback: `Georgia, 'Times New Roman', serif`.

**Body Text** — a clean, highly readable serif optimized for screen at 16–18px. Candidates: Literata, Charter, Iowan Old Style, Freight Text. Fallback: `Georgia, 'Iowan Old Style', serif`.

**UI / Nav / Metadata** — a restrained sans-serif for dates, navigation, issue numbers, and contributor metadata ONLY. Never in essay body or headlines. Candidates: Inter, Source Sans Pro. Fallback: `'Source Sans Pro', system-ui, sans-serif`.

```css
:root {
  /* Type scale — use clamp() for fluid sizing */
  --font-size-masthead:  clamp(2rem, 4vw, 3.5rem);
  --font-size-headline:  clamp(1.75rem, 3vw, 2.75rem);
  --font-size-subhead:   clamp(1.1rem, 1.8vw, 1.35rem);
  --font-size-body:      clamp(1rem, 1.2vw, 1.125rem);
  --font-size-small:     0.875rem;
  --font-size-caption:   0.8125rem;

  --line-height-body:     1.65;
  --line-height-headline: 1.15;
  --measure:              65ch;   /* max line length for body text */
}
```

### Drop Caps

The lead essay (whichever article has `featured: true`) gets a drop cap on its first paragraph: 3 lines tall, in `--color-accent`, display font. No other article gets a drop cap. This signals "this is the lead."

```css
.cover-story-body > p:first-of-type::first-letter,
.article-body.featured > p:first-of-type::first-letter {
  float: left;
  font-size: 3.5em;
  line-height: 0.8;
  padding-right: 0.08em;
  color: var(--color-accent);
  font-family: var(--font-display);
}
```

### Front Page Layout (`src/index.njk`)

The current layout uses a Barron's-style cover story + sidebar. Keep that two-column structure but restyle it to read as a Victorian broadsheet front, not a financial news portal:

1. **Masthead block** (centered, full-width): "THE FORTNIGHTLY CIRCULAR" in display serif, tracked-out small caps or letterspaced uppercase. Subtitle in italic below. Issue number and date in `--font-size-small` sans-serif. Thin decorative rule (`--color-rule`) below the masthead, spanning the full content width.

2. **Cover story** (left/main column): The `featured: true` article renders as a large display headline — this headline functions as the "hero image." Below: byline in small caps, dek/summary in italic, and the first ~200 words as visible lede text. No lead image unless it's a monochrome illustration (see Images section). The headline should be sized large enough (`--font-size-headline` at the upper end of its clamp range) that it commands attention without any photograph.

3. **"In This Number" sidebar** (right column): Restyle as a Victorian table of contents. Section header "IN THIS NUMBER" in letterspaced small caps. Each entry: contributor pseudonym in small caps, article title as a serif link, one-line italic description (the `dek` field). Thin rule (`--color-rule`) between entries. The sidebar background may use `--color-highlight` to subtly differentiate it from the main column.

4. **Previous issues** (below fold, full-width): Minimal — a compact list of past issues by number and date, or simply a link to an archive page.

```
Desktop (>768px):
┌──────────────────────────────────────────────────┐
│            THE FORTNIGHTLY CIRCULAR               │
│  Conducted for the Benefit of Persons of          │
│  Discernment & Enquiring Disposition              │
│  ─────────────────────────────────────────────    │
│  Vol. I · No. 1 · Spring 2026                    │
├─────────────────────────────┬────────────────────┤
│                             │  I N  T H I S      │
│  [Lead Headline — large,    │  N U M B E R       │
│   display serif, multi-     │  ───────────────   │
│   line if needed]           │                    │
│                             │  J. ALDERTON VANE  │
│  By H.C. WHITMORE           │  "Article Title"   │
│  The Machinery of           │  Brief italic      │
│  Consequence                │  description...    │
│                             │  ───────────────   │
│  First 200 words of the    │  ELEANORA SEFTON   │
│  cover essay, set in body   │  "Article Title"   │
│  serif at reading size...   │  Brief italic      │
│                             │  description...    │
│  [Continue Reading →]       │  ───────────────   │
│                             │  R.W. CALDER       │
│                             │  "Article Title"   │
│                             │  Brief italic      │
│                             │  description...    │
├─────────────────────────────┴────────────────────┤
│  ❧  Previous Numbers  ❧                          │
│  No. XI · 31 March — No. X · 17 March ...       │
└──────────────────────────────────────────────────┘

Mobile (≤768px): sidebar collapses below the cover story lede.
Masthead may shorten to "THE FORTNIGHTLY CIRCULAR" only,
dropping the subtitle.
```

### Article Pages (`src/_includes/article.njk`)

Single column. Max-width `var(--measure)` (65ch) for body text. Generous vertical rhythm.

Structure (top to bottom):
1. Thin masthead reference line: "THE FORTNIGHTLY CIRCULAR · No. [N]" — small, muted, linked back to index
2. Article title in display serif
3. Byline: "By [Pseudonym]" in letterspaced small caps, column name in italic below
4. Optional lead image (monochrome only — see Images section)
5. Body text
6. Ornamental rule (`hr.ornamental`)
7. Brief contributor note (one sentence, italic, `--color-muted`)
8. Continuation nav: prev/next article links (driven by `order` field)

### Horizontal Rules & Ornaments

Use thin rules to separate sections. Between articles in sidebar, between major sections on a page.

```css
hr {
  border: none;
  border-top: 1px solid var(--color-rule);
  margin: 2rem auto;
  max-width: var(--measure);
}

/* Major section breaks within essays — centered fleuron */
hr.ornamental {
  border: none;
  text-align: center;
  margin: 2.5rem auto;
}
hr.ornamental::before {
  content: '❧';
  color: var(--color-rule);
  font-size: 1.2em;
}
```

### Images & Illustrations

- **No photographs** on the front page or as default article lead images.
- Lead images (`leadImage` frontmatter) should be monochrome or duotone (black/sepia, optionally tinted with `--color-accent`). Style reference: Victorian engravings, woodcuts, pen-and-ink. AI-generated illustrations are acceptable IF they match this aesthetic. A photorealistic AI image is worse than no image.
- **Maximum one illustration per article**, either as the lead image (before body text) or as a section-break illustration. Not floating inline with text.
- **Charts and data visualizations** within essays are acceptable. Style them to match the palette: `--color-ink` for lines and labels, `--color-accent` for emphasis data, `--color-rule` for gridlines and axes. Never use default chart library colors (no Chart.js rainbow).
- **Captions**: `--font-size-caption`, italic, `--color-muted`.

### Paragraph Style

Indent paragraphs rather than adding vertical space between them. This is the traditional book/periodical convention and distinguishes us from web-native publications.

```css
.article-body p {
  text-indent: 1.5em;
  margin-bottom: 0;
}
.article-body p:first-of-type,
.article-body h2 + p,
.article-body h3 + p,
.article-body blockquote + p,
.article-body hr + p {
  text-indent: 0;  /* no indent after headings, blockquotes, or breaks */
}
```

### Blockquotes / Pull Quotes

```css
blockquote {
  border-left: 3px solid var(--color-accent);
  margin: 1.5rem 0;
  padding: 0.75rem 1.5rem;
  font-style: italic;
  color: var(--color-text);
  background: var(--color-highlight);
}
```

### Spacing

Generous. White space signals confidence — it says we don't need to cram things in.

```css
:root {
  --space-xs: 0.5rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2.5rem;
  --space-xl: 4rem;
}
```

### Responsive Behavior

- **Desktop (>768px)**: Two-column homepage (main + sidebar). Article pages single-column at `--measure`.
- **Mobile (≤768px)**: Single column everywhere. Sidebar "In This Number" content moves below the cover story lede. Masthead drops the subtitle line. Font sizes stay readable — `clamp()` values already handle this.
- The mobile reading experience should be BETTER than desktop. A reader on their phone during a commute is exactly our audience.

### Print Stylesheet

Include `@media print` rules. Our readers may print essays.

```css
@media print {
  body { background: white; color: black; }
  nav, .sidebar, .subscribe-form, .connectivity-dot,
  footer nav, .article-nav { display: none; }
  .article-body { max-width: 100%; font-size: 11pt; }
  a { color: black; text-decoration: none; }
  a[href]::after { content: ' (' attr(href) ')'; font-size: 0.8em; }
  @page { margin: 2cm; }
}
```

Add a footer line on print: "The Fortnightly Circular · fortnightlycircular.com · [Issue No.]"

### Things to Never Do

These are explicit constraints. If a design change triggers any of these, reject it.

- Never add a hero image banner or full-bleed photograph at the top of any page
- Never use a hamburger menu — navigation should be minimal enough to not need one
- Never use card-based layouts with image thumbnails (this is not Medium)
- Never use rounded corners on content containers
- Never use box shadows or depth/elevation effects
- Never add loading animations or skeleton screens
- Never add a dark mode toggle — the warm `--color-paper` background IS the brand
- Never use emoji in any editorial content or UI
- Never auto-play anything
- Never add a pop-up or modal newsletter signup (the existing subscribe form in the footer is sufficient)
- Never add social share buttons, comment sections, or "related articles" recommendations
- Never use web fonts that require cookie consent banners (prefer self-hosted or system fonts)
- Never introduce a second accent color

### Design Decision Test

When evaluating any visual change, apply these in order:

1. Would this feel at home in a 19th-century periodical? (Not literally — but does it share the values of restraint, hierarchy, and typographic craft?)
2. Does this respect the reader's attention rather than compete for it?
3. Does this differentiate us from Substack / Medium / Barron's / Bloomberg, or does it make us look more like them?
4. Could we remove this element entirely and lose nothing? If yes, remove it.