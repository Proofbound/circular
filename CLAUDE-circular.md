# Karam & Sprague's Fortnightly Circular

**Last Updated**: April 8, 2026
**Status**: Migration in progress (Netlify/Firebase → ProofBound Platform API)

A static online magazine — high-quality think pieces and light reading, styled like a high-brow Victorian periodical. Published by Sami J. Karam and Richard Sprague.

## Architecture

Circular is a **static site + API consumer**. All dynamic behavior (auth, subscriptions, email) is handled by the ProofBound platform API running on the monorepo's DigitalOcean droplet. Circular has zero serverless functions of its own.

```
proofbound.com/circular         proofbound.com/api/v1/platform
(DO App Platform, static)       (DO droplet, FastAPI)
        │                               │
        ├─ Supabase JS client ─────→ Supabase Auth (direct)
        ├─ POST /subscribe ────────→ subscriptions table
        ├─ POST /unsubscribe ──────→ subscriptions table
        └─ GET  /health ───────────→ connectivity check
```

### What Circular Does NOT Own

- **Auth**: Uses Supabase JS client directly (same project as the book app). No auth endpoints in the platform API needed — Supabase client handles signup/login/session.
- **Email dispatch**: Handled by the monorepo's existing Supabase Edge Function (`send-notification`) + Resend. Circular just adds a `circular_newsletter` email type.
- **User accounts**: Shared with the book app. One Supabase project, one `auth.users` table. A Circular subscriber who later uses the book app is the same user.
- **Serverless functions**: None. The old Netlify Functions and Firebase dependencies are deleted.

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
images/                # Image assets
eleventy.config.js     # Eleventy configuration
Taskfile.yml           # Task runner
```

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

### Subscriptions (platform API)

```javascript
// Subscribe to Circular newsletter
const res = await fetch('https://proofbound.com/api/v1/platform/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, product: 'circular' })
})

// Unsubscribe
const res = await fetch('https://proofbound.com/api/v1/platform/unsubscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, product: 'circular' })
})
```

### Connectivity check

On page load, `circular.js` pings `proofbound.com/api/v1/platform/health`. If reachable, the Sign In button glows green. This replaces the old Netlify hello function ping.

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
