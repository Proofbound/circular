# Karam & Sprague's Fortnightly Circular

**Last Updated**: April 10, 2026
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
  articles/            # Article content with YAML frontmatter
    <slug>.html
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

**New binary assets (images, fonts, anything not source) go under `assets/` and must be committed to git.** Eleventy passthrough-copies `assets/` → `_site/assets/`; a file sitting in a local working tree but un-staged will build locally and 404 in production (this is how the masthead shipped as a broken 16px placeholder — the JPG was never `git add`ed). Any new image: `git add assets/<file>` before referencing it from a template.

**Legacy exception**: [eleventy.config.js](eleventy.config.js) also passthrough-copies `articles/**/*.{jpg,jpeg,png}` from the repo root into `_site/articles/`. One article image (`articles/stop-calling-me-the-great.jpeg`) still relies on this. New article images should go in `assets/` instead, referenced via a relative path like `../assets/<file>`.

### Deleted (migration from prototype)

These files/directories no longer exist and must not be recreated:

- `netlify.toml` — no Netlify dependency
- `netlify/functions/` — all serverless logic moved to monorepo platform API
- Any Firebase SDK imports or config — replaced by Supabase JS client

## Adding a New Article

1. Create `src/articles/<slug>.html` with YAML frontmatter:
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
   order: 8                   # reading order within the issue
   permalink: "articles/{{ page.fileSlug }}.html"
   ---
   <p>Article body HTML here...</p>
   ```
2. Run `npm run build` — continuation nav and index page update automatically
3. For lead images, add `leadImage:` block to frontmatter (see existing articles for examples)

## Content Organization

Articles are organized by **section** on the index page:
- **Analysis** — longform think pieces (geopolitics, finance, AI)
- **Light Reading** — shorter, more accessible pieces

Frontmatter fields `section`, `subsection`, and `order` drive the index page sections, TOC sidebar, and article continuation nav automatically.

## Auth & Subscriptions (circular.js)

### Supabase Auth (client-side)

```javascript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Signup / login / session handled directly via Supabase JS SDK
// Same Supabase project as the book app — shared user identity
```

### Subscriptions (platform API) — implemented in [js/circular.js](js/circular.js)

`initSubscribe()` POSTs the modal form to `cfg.platformApiUrl + '/subscribe'` (default `https://proofbound.com/api/v1/platform`). The API base URL comes from `window.CIRCULAR_CONFIG` so local dev can override it.

```javascript
// Subscribe — request body shape
{
  email: 'user@example.com',
  product: 'circular',
  // turnstile_token: '...',   // TODO — required in production once TURNSTILE_SECRET_KEY is set
  // website: ''                // TODO — honeypot, must be present and empty
}

// Unsubscribe — same shape minus turnstile/honeypot, idempotent (always 200)
```

**Known client gaps** (server already supports both):
- The subscribe form does **not** yet include a Cloudflare Turnstile widget or `turnstile_token` field. Once the production cc-template-api sets `TURNSTILE_SECRET_KEY`, every Circular subscribe will return `400 captcha_verification_failed` until this is wired.
- The form does **not** yet include the `website` honeypot input. Add a hidden `<input name="website">` and pass its value through.

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
