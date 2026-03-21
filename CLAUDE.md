# Karam & Sprague's Fortnightly Circular

A static online magazine — high-quality think pieces and light reading, styled like a high-brow Victorian periodical. Published by Sami J. Karam and Richard Sprague.

## Build

```bash
npm install          # one-time setup
npm run build        # generates _site/ from src/
npm run serve        # local dev server with live reload
```

- **SSG**: Eleventy (11ty) v3
- **Input**: `src/` (Nunjucks templates + HTML articles with YAML frontmatter)
- **Output**: `_site/` (static HTML/CSS/JS ready for deployment)

## Deployment

- Served at: `https://proofbound.com/circular`
- Own repo: `Proofbound/circular` (this repo)
- Own DO App Platform static site (separate from proofbound-oof)
- Cloudflare Worker proxies `proofbound.com/circular/*` → DO app (stripping `/circular` prefix)
- All asset paths must be relative (no absolute root-relative paths like `/css/...`)
- DO App Platform should serve from `_site/` output directory

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
js/circular.js         # Interactive features (passthrough copied to _site/)
images/                # Image assets
eleventy.config.js     # Eleventy configuration
```

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
3. For lead images, add `leadImage:` block to frontmatter (see stop-calling-me-the-great.html)

## Content Organization

Articles are organized by **section** on the index page:
- **Analysis** — longform think pieces (geopolitics, finance, AI)
- **Light Reading** — shorter, more accessible pieces

Frontmatter fields `section`, `subsection`, and `order` drive the index page sections, TOC sidebar, and article continuation nav automatically.

## Design Principles

- Elegant, typographic, magazine-quality aesthetic
- Cream/off-white background with rich dark serif type
- Minimal JavaScript — mostly CSS-driven layout
- Mobile responsive
