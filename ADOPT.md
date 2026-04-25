# Adopt the ProofBound design system

> **Drop this file into the root of any ProofBound property** (rename to
> `CLAUDE.md`, or place alongside an existing one). It tells the Claude
> or human reading it everything needed to bring the property onto the
> ProofBound design system.

## What this is

ProofBound has one design system, hosted at:

    https://brand.proofbound.com/proofbound-design-system/

It is a single self-contained folder: one stylesheet (tokens + `.pb-*`
component classes), self-hosted variable woff2 (Crimson Pro + Inter),
SVG marks. The CSS references its fonts and assets by relative path, so
linking the one stylesheet from the CDN pulls everything else in.

You **link** to it from this property. You do **not** copy the folder
in. There is one source of truth across every ProofBound product.

## How to adopt

### 1. Link the stylesheet

In every HTML/template entry point:

    <link rel="stylesheet" href="https://brand.proofbound.com/proofbound-design-system/proofbound.css">

For Vite / Next / Astro / etc., import once from your root layout:

    import 'https://brand.proofbound.com/proofbound-design-system/proofbound.css';

If the bundler can't import remote CSS, use a `<link>` in the document
template instead. **Do not mirror the CSS into local assets** — the CDN
URL is the single source. That includes fonts: do not bundle Crimson
Pro or Inter into the app, the woff2 ships from the CDN.

### 2. Replace any old ProofBound brand URLs

Search the repo and replace:

| Old URL | New URL |
|---|---|
| `brand.proofbound.com/css/tokens.css` | `brand.proofbound.com/proofbound-design-system/proofbound.css` |
| `brand.proofbound.com/css/proofbound.css` | `brand.proofbound.com/proofbound-design-system/proofbound.css` |
| `brand.proofbound.com/tokens/...` | `brand.proofbound.com/proofbound-design-system/proofbound.css` |
| `brand.proofbound.com/logos/proofbound-logo*.svg` | `brand.proofbound.com/proofbound-design-system/assets/proofbound-logo.svg` |
| `brand.proofbound.com/marks/family/hexagon-frame.svg` | `brand.proofbound.com/proofbound-design-system/assets/hexagon-frame.svg` |
| `brand.proofbound.com/marks/imprints/<name>/...` | `brand.proofbound.com/proofbound-design-system/assets/marks/<name>.svg` |
| `brand.proofbound.com/components/...`, `/preview/...` | delete; superseded |

The old URLs return 404 and are not coming back. Do not add a redirect
shim, do not mirror old paths locally — fix the consumer reference.

### 3. Remove hardcoded brand values

Replace with tokens (the full inventory is in the `:root` block of
`proofbound.css` — read it once):

- Hex colors → `var(--accent)`, `var(--text)`, `var(--text-muted)`,
  `var(--paper)`, `var(--paper-100)`, `var(--rule)`, etc.
- `font-family:` → `var(--font-serif)` (Crimson Pro),
  `var(--font-sans)` (Inter), `var(--font-mono)`.
- Hardcoded `border-radius` → `var(--radius-sm)` (4px) or
  `var(--radius-md)` (8px). **No radius above 8px.**
- Hardcoded px spacing → `var(--space-1)` (4px) through
  `var(--space-48)` (192px), on a 4px rhythm.
- `transition-duration` → `var(--duration-fast|base|slow)` paired with
  `var(--ease-standard|entrance|exit)`.
- "Crimson Text" → "Crimson Pro". Remove every Google Fonts `@import`
  for Crimson — we self-host the variable woff2 now.

### 4. Use `.pb-*` component classes

Replace bespoke styling with these where they fit:

- `.pb-display .pb-h1 .pb-h2 .pb-h3` — headings (h1/h2/h3 auto-style too)
- `.pb-eyebrow .pb-caption` — labels and supporting text
- `.pb-prose` — reading container; auto-styles children. Add
  `.pb-prose--dropcap` for an editorial drop-cap on the first paragraph.
- `.pb-rule-ornament` — centered ornamental "· · ·" between sections
- `.pb-button --primary --secondary --ghost`
- `.pb-card` — flat editorial surface (1px hairline, no shadow)
- `.pb-book` — 2:3 cover container; set `--pb-book-cover` for color
- `.pb-endorsement` — "a Proofbound imprint" lockup

Every class with HTML examples:
https://brand.proofbound.com/proofbound-design-system/COMPONENTS.md

### 5. Set the imprint (if applicable)

The flagship ProofBound app is the default (oxblood accent).
Sub-properties retint the accent ramp by setting `data-imprint` on a
container; every `.pb-*` element inside retints automatically:

    <body data-imprint="circular">    <!-- navy  — Fortnightly Circular  -->
    <body data-imprint="editions">    <!-- brown — the curated catalog   -->
    <body data-imprint="workshop">    <!-- olive — tools (TextKeep etc.) -->

If unsure which applies, leave it default. Do not invent new imprints
inside a consumer repo — new imprints are added in
`proofbound-shared/proofbound-design-system/proofbound.css`.

### 6. Voice & copy

Before touching any user-facing text, read:
https://brand.proofbound.com/proofbound-design-system/BRAND.md

Short version: direct, confident, specific, quietly literary. *The
Atlantic*-adjacent, not SaaS-landing-page. Anchor every claim to
economics, permanence, specificity, speed, or editorial seriousness.
Never use "empower," "unleash," "magic," "game-changer," "leverage,"
"AI-powered." No emoji. No `!`.

## Hard rules — never violate

Enforced by the design system. Code that breaks these is wrong even if
it renders.

- **Never hardcode** colors, fonts, spacing, radii, or durations. Use
  the tokens.
- **Never override base tokens** in a consumer repo. Retint via
  `data-imprint`, not by redefining `--text`, `--paper`, `--accent`.
- **Never redraw the hexagon.** Use the SVGs in `/assets/`.
- **Never mirror the design-system folder locally.** Link from the CDN.
- **No `border-radius` above 8px.** The system caps at `--radius-md`.
- **No dark mode, no gradients, no SaaS hover effects** (no shadow
  lift, no scale-on-hover, no glassmorphism, no animated gradients).
- **No emoji.** No stock photography of hands typing on laptops.
- **The wordmark and hexagon are ink black** (`var(--text)`), not
  oxblood. Oxblood is the *accent* — eyebrows, links, primary button
  fills, drop caps. Not the logo.
- **Do not preserve backward compatibility** with prior brand URLs or
  prior class names. Old brand URLs are 404. Fix the reference, do not
  add a shim.

## When done — verify

Run these and fix anything that surfaces:

    # 1. No references to old brand URLs
    grep -rE 'brand\.proofbound\.com/(css|tokens|logos|marks|components|preview)/' . \
      --exclude-dir=node_modules --exclude-dir=.git

    # 2. No Crimson Text, no Google Fonts for brand typefaces
    grep -rE 'Crimson Text|fonts\.googleapis\.com.*Crimson|fonts\.googleapis\.com.*Inter' . \
      --exclude-dir=node_modules --exclude-dir=.git

    # 3. Hardcoded brand colors (filter false positives by hand)
    grep -rE '#[0-9a-fA-F]{3,6}' src/ | grep -vE 'var\('

In the browser:

- DevTools → Network. Every `brand.proofbound.com/...` request should
  fall under `/proofbound-design-system/`, `/favicons/`, `/og/`, or
  `/js/analytics.js`. Anything else is a leftover.
- Visually compare to the live reference:
  https://brand.proofbound.com/proofbound-design-system/design-system.html
- Confirm: Crimson Pro on headings/body (not Crimson Text), oxblood (or
  imprint accent) on links and primary buttons, no gradients, no
  glassmorphism, no shadow lifts on hover.

## Reference URLs

- Live visual reference: https://brand.proofbound.com/proofbound-design-system/design-system.html
- Components — every class with HTML: https://brand.proofbound.com/proofbound-design-system/COMPONENTS.md
- Voice and copy: https://brand.proofbound.com/proofbound-design-system/BRAND.md
- Canonical copy of this adoption doc: https://brand.proofbound.com/proofbound-design-system/ADOPT.md

## When something doesn't fit

Open `design-system.html` in a browser. If the pattern you need is
there, use it. If it isn't, the answer is almost always "use less
styling, not more" — the system is intentionally restrained.

You may compose existing components and tokens in new ways inside this
property. You may **not** extend the system from a consumer repo. New
components and new tokens land in `proofbound-shared/proofbound-design-system/`,
not here.
