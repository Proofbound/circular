# Karam & Sprague's Fortnightly Circular

A static online magazine — high-quality think pieces and light reading, styled like a high-brow Victorian periodical. Published by Sami J. Karam and Richard Sprague.

## Deployment

- Served at: `https://proofbound.com/circular`
- Own repo: `Proofbound/circular` (this repo)
- Own DO App Platform static site (separate from proofbound-oof)
- Cloudflare Worker proxies `proofbound.com/circular/*` → DO app (stripping `/circular` prefix)
- All asset paths must be relative (no absolute root-relative paths like `/css/...`)
- Static HTML/CSS/JS only — no build step required

## Structure

```
index.html          # Main page: masthead + TOC + article previews
articles/           # Individual article HTML files
css/
  style.css         # Main stylesheet
2026-04/            # Source articles (markdown + docx)
```

## Content Organization

Articles are organized by **section** on the index page:
- **Analysis** — longform think pieces (geopolitics, finance, AI)
- **Light Reading** — shorter, more accessible pieces

## Adding a New Article

1. Write or convert article to HTML in `articles/<slug>.html`
2. Add entry to the `articles` array in `index.html`
3. Add article card to the appropriate section in the TOC

## Design Principles

- Elegant, typographic, magazine-quality aesthetic
- Cream/off-white background with rich dark serif type
- Minimal JavaScript — mostly CSS-driven layout
- Mobile responsive
