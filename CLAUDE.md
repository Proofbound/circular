# Karam & Sprague's Fortnightly Circular

**Last Updated**: April 11, 2026
**Status**: Migrated off Netlify/Firebase. Platform API Phase 1 (subscribe / unsubscribe / health) implemented server-side and wired in `circular.js`. Newsletter dispatch (Phase 2) is deferred — sends are manual until then. See [PLAN-monorepo-platform.md](PLAN-monorepo-platform.md) for the full plan and remaining deploy steps.

A static online magazine — high-quality think pieces and light reading, styled like a high-brow Victorian periodical. Published by Sami J. Karam and Richard Sprague.

## Architecture

Circular is a **static site + API consumer**. All dynamic behavior (auth, subscriptions, email) is handled by the ProofBound platform API running on the monorepo's DigitalOcean droplet. Circular has zero serverless functions of its own.

```
proofbound.com/circular         proofbound.com/api/v1/platform
(DO App Platform, static)       (DO droplet, FastAPI in cc-template-api)
        │                               │
        ├─ Supabase JS client ─────→ Supabase Auth (direct, same project as book app)
        ├─ POST /subscribe ────────→ email_subscriptions table (service-role)
        ├─ POST /unsubscribe ──────→ email_subscriptions table (idempotent)
        └─ GET  /health ───────────→ connectivity check (green dot in nav)
```

The platform router lives inside cc-template-api on port 8001 — no separate service or container. Public endpoints are listed in `UNPROTECTED_PATHS` in `hybrid_auth.py` and rate-limited via slowapi (10/min subscribe, 30/min unsubscribe, per-IP).

### What Circular Does NOT Own

- **Auth**: Uses Supabase JS client directly (same project as the book app). No auth endpoints in the platform API — Supabase client handles signup/login/session. (Wiring still TODO in `circular.js`; see "Auth & Subscriptions" below.)
- **Email dispatch**: Phase 2, currently deferred. Until it ships, newsletter sends are done manually (Resend dashboard or one-off script reading from `email_subscriptions`). When it lands it will route through the existing `send-notification` Edge Function or Resend's batch API — see §4 of [PLAN-monorepo-platform.md](PLAN-monorepo-platform.md).
- **User accounts**: Shared with the book app. One Supabase project, one `auth.users` table. A Circular subscriber who later creates a book-app account is the same user — `email_subscriptions.user_id` is backfilled automatically.
- **Serverless functions**: None. The old Netlify Functions and Firebase dependencies are deleted and must not come back.

## Build

```bash
npm install          # one-time setup
npm run build        # generates _site/ from src/
npm run serve        # local dev server
```

- **SSG**: Eleventy (11ty) v3
- **Input**: `src/` (Nunjucks templates + HTML articles with YAML frontmatter)
- **Output**: `_site/` (static HTML/CSS/JS ready for deployment)

## Deployment

- **Static site (DO App Platform):** serves `proofbound.com/circular`
  - Cloudflare Worker proxies `proofbound.com/circular/*` → DO app (stripping `/circular` prefix)
  - Auto-deploys from `main` branch on push
  - All asset paths must be relative (no absolute root-relative paths like `/css/...`)
  - Free tier: up to 3 static apps, 1 GiB outbound transfer

## Structure

```
src/
  _includes/
    base.njk          # Base HTML shell (masthead, footer, scripts)
    article.njk       # Article page layout (nav, header, continuation, share)
  _data/
    site.json          # Site config (title, volume, issue, editors, URLs)
    authors.js         # Author bios / metadata
  articles/            # Article content (markdown + YAML frontmatter)
    <issue>/           # e.g. 2026-04/ — one folder per issue
      <slug>.md
  index.njk            # Index page template
  404.njk              # 404 page template
css/style.css          # Stylesheet (passthrough copied to _site/)
js/circular.js         # Auth, subscriptions, connectivity (calls platform API)
assets/                # Canonical home for all binary assets (masthead, author bios, etc.)
images/                # Legacy image dir, also passthrough copied — prefer assets/ for new files
eleventy.config.js     # Eleventy configuration
Taskfile.yml           # Task runner
```

### Asset rule

**Site chrome** (masthead, fonts, author bios, anything shared across pages) lives under `assets/` and is passthrough-copied to `_site/assets/`. Commit new files with `git add assets/<file>` before referencing them — an un-staged file builds locally and 404s in production.

**Article lead images** live alongside the article's markdown source at `src/articles/<issue>/<file>.jpg`. [eleventy.config.js](eleventy.config.js) passthrough-copies `src/articles/**/*.{jpeg,jpg,png}` into a flat `_site/articles/` directory (same level as the rendered article HTML), so the frontmatter reference is just the bare filename:

```yaml
leadImage:
  src: "gary-sick-cnn.jpeg"    # resolves to /circular/articles/gary-sick-cnn.jpeg
  alt: "..."
```

The index template prefixes the cover story's image with `articles/` automatically, so the same bare filename works in both contexts.

### Deleted (migration from prototype)

These files/directories no longer exist and must not be recreated:

- `netlify.toml` — no Netlify dependency
- `netlify/functions/` — all serverless logic moved to monorepo platform API
- Any Firebase SDK imports or config — replaced by Supabase JS client

## Adding a New Article

1. Create `src/articles/<issue>/<slug>.md` with YAML frontmatter:
   ```yaml
   ---
   layout: article.njk
   title: "Article Title"
   section: "Analysis"        # or "Light Reading"
   subsection: "Topic"
   dek: "Summary text"
   author: "Author Name"
   pubDate: "Season Year"
   issue: "vol1-no1"
   order: 8                   # reading order within the issue (see below)
   featured: true             # optional — marks this article as the cover story
   permalink: "articles/{{ page.fileSlug }}.html"
   ---

   Article body as plain markdown — paragraphs, `##` headings, `*italics*`, `**bold**`, `---` for section breaks. Inline HTML is allowed when needed.
   ```
2. Run `npm run build` — continuation nav and index page update automatically
3. For lead images, add `leadImage:` block to frontmatter (see existing articles for examples)

## Content Organization

Articles are organized by **section** on the index page:
- **Analysis** — longform think pieces (geopolitics, finance, AI)
- **Light Reading** — shorter, more accessible pieces

### `order` — reading order within the issue

`order` is a single integer that governs **two** things:

1. **Sidebar sort order on the index page.** Articles in the "In This Issue" sidebar are listed in ascending `order` within each section (Analysis first, then Light Reading). Lower numbers appear higher in the list. Gaps are fine — it's just a sort key, not an index.
2. **Article continuation nav (prev/next at the bottom of each article page).** The next/prev links walk the full ordered list across both sections, so `order: 4` → `order: 5` → `order: 6` even if 5 is in a different section from 4. Pick numbers that give the reader a sensible flow, not just a sort.

Conventions:
- **Start at 1.** The flagship piece is typically `order: 1` so casual readers who click "Read next" from the cover story get the editor's recommended opening.
- **Keep numbers contiguous within an issue.** A published issue should have `1, 2, 3, ...` with no gaps — gaps make the continuation nav feel arbitrary.
- **Drafts and TODO articles use `order: 99`** and `section: "TODO"` so they drop out of both the sidebar and the continuation walk without being deleted.
- **Renumbering is cheap.** If you reorder mid-edit, bump every affected article's `order` and rebuild — nothing else caches the numbering.

### `featured` — which article is the cover story

The front page renders **one** article as a full-width Barron's-style cover ([src/index.njk](src/index.njk)). Selection rules, in order:

1. If any article has `featured: true`, the first such article wins. There should only ever be one per issue.
2. Otherwise the template falls back to `order: 1` (see [src/index.njk](src/index.njk) at the top, inside the `{% if not featured %}` block).

The cover story is **excluded** from the sidebar list — the sidebar shows every _other_ article so nothing is duplicated on the page. If you flag an article as featured and still see it in the sidebar, rebuild; the filter is `{% if not article.data.featured %}` inside each `<ul>`.

Cover-story choice is decoupled from reading order on purpose: you can put the most visually striking or topical piece at the top of the page while keeping a different article at `order: 1` if the editor prefers a different opening read. For vol1-no1 the flagship "Iran, Give Me My Country Back" carries both `order: 1` and `featured: true`.

Frontmatter fields `section`, `subsection`, `order`, and `featured` drive the index page sections, TOC sidebar, cover story, and article continuation nav automatically.

## Auth & Subscriptions (circular.js)

### Supabase Auth (client-side)

```javascript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Signup / login / session handled directly via Supabase JS SDK
// Same Supabase project as the book app — shared user identity
```

### Subscriptions (platform API) — implemented in [js/circular.js](js/circular.js)

`initSubscribe()` POSTs the modal form to `cfg.platformApiUrl + '/subscribe'` (default `https://proofbound.com/api/v1/platform`). The API base URL comes from `window.__CIRCULAR__` (set inline in base.njk from `site.json`) so local dev can override it.

```javascript
// Subscribe — request body shape
{
  email: 'user@example.com',
  product: 'circular',
  website: '',                 // honeypot — hidden input, must be empty
  // turnstile_token: '...',   // TODO — required in production once TURNSTILE_SECRET_KEY is set
}

// Unsubscribe — same shape minus turnstile/honeypot, idempotent (always 200)
```

The `<form>` in [src/_includes/base.njk](src/_includes/base.njk) is also hardened with `method="post"`, `action="{{ site.platformApiUrl }}/subscribe"`, and `onsubmit="return false"` so a JS failure cannot fall back to a native GET and leak the email into a URL query string. The JS handler calls `e.preventDefault()` and runs the real fetch — the form attributes are a safety net, not the happy path.

**Known client gap** (server already supports it):
- The subscribe form does **not** yet include a Cloudflare Turnstile widget or `turnstile_token` field. Once the production cc-template-api sets `TURNSTILE_SECRET_KEY`, every Circular subscribe will return `400 captcha_verification_failed` until this is wired.

Server contract details (rate limits, response shapes, validation rules) are in the "Phase 1 — Client Integration Guide" at the top of [PLAN-monorepo-platform.md](PLAN-monorepo-platform.md).

### Connectivity check

On page load, `initSigninStatus()` in `circular.js` pings `<platformApiUrl>/health`. If it returns 200, the Sign In button gets a green indicator. This replaces the old Netlify hello function ping. Supabase Auth session-checking is stubbed out (`TODO` block) — needs wiring before login actually works.

## Design Principles

- Elegant, typographic, magazine-quality aesthetic
- Cream/off-white background with rich dark serif type
- Minimal JavaScript — mostly CSS-driven layout
- Mobile responsive
- Zero serverless functions — Circular is a pure static site

## Critical Rules

1. **No serverless functions in this repo.** All dynamic behavior lives in the monorepo platform API.
2. **No Firebase.** Auth is Supabase. Subscriptions are the platform API.
3. **No Netlify.** Hosting is DO App Platform. No `netlify.toml`, no Netlify CLI.
4. **Relative asset paths only.** The Cloudflare Worker strips `/circular` prefix — absolute paths break.
5. **Shared user identity.** Use the same Supabase project URL and anon key as the book app. Never create a separate Supabase project.
6. **Content is king.** The articles in `src/articles/` are the only irreplaceable asset. Everything else can be rebuilt.
