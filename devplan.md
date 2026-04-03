# Development Plan — Status as of 2026-03-22

## Technical Summary

Refresh the Proofbound Circular static magazine at https://proofbound.com/circular to deliver a modern, Substack-like browsing and reading experience—updating the shared design system, adding interactive issue navigation, standardizing article templates with in-issue continuation, and shipping a branded 404—while preserving static HTML delivery on DigitalOcean App Platform behind the exact Cloudflare Worker proxy that routes /circular/* traffic.

## Implementation Status

### DONE — Design System Refresh
- CSS token system extended with interaction tokens (transitions, focus rings, shadows)
- Focus-visible styles on all interactive elements
- Visited link differentiation
- Card hover affordances (translateY lift)
- Button component (.btn, .btn--filled, .btn--sm) with all states
- Long title overflow-wrap handling
- Reduced motion media query (prefers-reduced-motion)
- Responsive layouts at 800px and 500px breakpoints

### DONE — Issue Page Interactions
- IntersectionObserver-based nav-bar section highlighting
- Smooth scroll with sticky-header offset
- Hash deep links on page load with correct scroll position
- Mobile TOC toggle (accessible button, aria-expanded)
- Scroll fallback for browsers without IntersectionObserver

### DONE — Article Reading Experience
- Consistent article template via Nunjucks layout (article.njk)
- "Back to the Circular" persistent nav
- Next/previous continuation nav computed from frontmatter order
- "Next up" teaser module; "End of Issue" on last article
- Subscribe banner near top of every article
- Share controls: X (Twitter), Facebook, Copy link with clipboard fallback
- Comments placeholder (data-comments attribute, dashed-border container)

### DONE — Hosted App Integration (v1 entry points)
- "Sign in" link in nav-bar on all pages (href configurable via site.json)
- "Subscribe" banner on index and all articles (href configurable via site.json)
- No auth/subscription state detection (v1 constraint met)

### DONE — Branded 404
- Root-level 404.html with masthead, branded message, return button
- DO App Platform serves it for missing routes (verified live)
- Relative paths compatible with Worker proxy

### DONE — Content Authoring & Build Pipeline
- Eleventy (11ty) v3 as static site generator
- HTML content files with YAML frontmatter in src/articles/
- Nunjucks templates: base.njk (shell) + article.njk (article layout)
- Site config in src/_data/site.json
- Index page and TOC auto-generated from article collections
- Continuation nav auto-computed from frontmatter order
- Passthrough copy for css/, js/, images/, masthead assets
- Output to _site/ with all relative paths
- DO App Platform configured: build_command="npm run build", output_dir="_site"
- deploy_on_push enabled from main branch

### DONE — Performance & Accessibility
- JS is ~140 lines, zero dependencies
- Focus-visible styles and semantic landmarks throughout
- Reduced motion support
- Keyboard navigation for all interactive elements

## Remaining / Future Work

### Not Yet Implemented
- TOC collapsible section groups (not needed yet with only 7 articles)
- Missing anchor edge handling in TOC (graceful fallback if IDs mismatch)
- External link styling differentiation

### Deferred by Design (v1 constraints)
- Hosted subscribe flow (Resend email capture) — requires hosted app
- SSO login (Google/Apple) — requires hosted app
- Auth/subscription state detection ("Account", "Subscribed", "Manage" UI)
- Return URL deep-links to hosted endpoints
- Comments provider integration (placeholder only; no provider committed)

## System Design Reference

### Hosting/Routing (contract — do not change)
- Cloudflare Worker on proofbound.com / www.proofbound.com
- Match: pathname.toLowerCase().replace(/\/$/, "").startsWith("/circular")
- Proxy: forward to https://circular-n9vc9.ondigitalocean.app with /circular stripped
- Forwarded path: url.pathname.replace(/^\/circular/i, "") || "/"
- Query string preserved, cf: { cacheEverything: false }

### Path Constraints
- All asset/link paths must be relative (no root-relative /css/...)
- Consistent canonical casing for filenames
- No trailing slashes on file-like pages
- Hash fragments are client-side only

### Frontmatter Fields
- `layout`: article.njk
- `title`: article title
- `section`: "Analysis" or "Light Reading"
- `subsection`: topic label
- `dek`: summary/description
- `author`: byline (omit for anonymous)
- `pubDate`: display date (not Eleventy's reserved `date`)
- `issue`: issue identifier (e.g. "vol1-no1")
- `order`: reading order within issue (drives prev/next nav)
- `permalink`: "articles/{{ page.fileSlug }}.html"
- `leadImage`: optional { src, alt, caption } for hero image
