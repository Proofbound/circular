# Modernize Visual Design System

## Context
The goal is to refresh Circular’s visual design system so the static site feels modern, premium, readable, and consistent across the issue landing page, article pages, and the 404 page while preserving static delivery and existing routing constraints. Relevant constraints and existing patterns from the PRD and Tech Brief:

- Site is a static HTML/CSS site served from a DigitalOcean static origin and fronted by an exact Cloudflare Worker that strips the `/circular` prefix. This enforces relative asset/link paths and consistent canonical path casing/formatting.
- Existing design conventions to retain where appropriate:
  - CSS tokens via `:root` custom properties for colors/typography/spacing.
  - BEM-like class naming and semantic HTML landmarks (header/nav/main/section/footer).
  - Responsive breakpoints already used (~800px and ~500px).
  - Google Fonts imported in CSS (Playfair Display, Source Serif 4, Source Sans 3).
- User story acceptance criteria (from PRD):
  - Consistent design system across issue, article, and 404 pages (typography, spacing, colors, buttons, links, cards).
  - Clear visual hierarchy on the issue landing page (masthead/hero, issue metadata, featured items, section navigation).
  - Distinct interactive vs non-interactive states (hover/focus/active/visited).
  - Responsive layout across mobile/tablet/desktop without horizontal overflow.
  - Baseline accessibility: readable contrast, visible keyboard focus, semantic headings.
- Edge cases called out:
  - Very long titles/bylines must wrap/truncate gracefully.
  - Missing excerpts/metadata: lists/cards render with sensible spacing.
  - Respect reduced-motion preferences (minimize/disable nonessential animations).
- Tech-brief cross-cutting requirements:
  - Extend existing CSS token system to cover issue/article/404.
  - Provide visible focus styles and reduced-motion support.
  - Optional third-party embeds (comments) must be styled and must not degrade readability when disabled.

## Scope Boundaries

**In scope for this user story**
- Define and extend the shared design system tokens (colors, type scale, spacing, interaction tokens) to cover:
  - Issue landing page components (masthead, hero, featured cards, section navigation).
  - Article page components (headers, metadata, body typography, next/previous and “Next up” modules, engagement module placements).
  - 404 page visual treatment (typography, spacing, buttons/links consistent with the system).
- Update or add CSS (and small client-side CSS/JS necessary for accessible microinteraction defaults) to ensure:
  - Consistent interactive states (hover/focus/active/visited) and visible focus styles.
  - Responsive typographic scale and layout adjustments for ~800px and ~500px breakpoints.
  - Reduced-motion support for smooth-scrolling/microinteractions.
  - Handling of long titles, missing metadata, and short-article layouts without layout breakage.
- Ensure all visual changes respect the static hosting and Worker constraints (relative paths, canonical casing/trailing-slash behavior).
- Accessibility baseline: ensure contrast, keyboard focus visibility, and semantic headings are implemented within the design system.

**Out of scope for this user story**
- Implementing interactive features or behaviors that are separate stories, including:
  - Generating or wiring the interactive Issue Table of Contents (separate story).
  - Section navigation scrolling logic (separate story).
  - Full article template data-binding, ordering logic, or build-pipeline changes driven by YAML frontmatter (handled in other stories/tech brief).
  - Hosted auth/subscription state UI (the Tech Brief v1 constraint: do not implement Account/Subscribed state detection in the static site).
  - Selecting or integrating a comments provider (comments styling must be considered, but provider integration is a separate story).
- Backend work, hosted-app changes, or subscription/auth flows.

## Repo Boundaries
- Proofbound/circular - Primary static-site repository containing `index.html`, `articles/`, `css/style.css`, `images/`, and deployment guidance (`CLAUDE.md`); update the shared stylesheet and add any design-system assets here.
- Circular/circular-static-site - Repository referenced by product user stories as the static-site target; ensure styling updates or design-system artifacts are applied where this repo is considered the implementation target.

(Only these static-site repositories are in scope for design-system changes; hosted app repos and comment/auth providers are out of scope for this user story.)

## Suggested Research
- Review css/style.css to inventory existing :root tokens, typographic scale, spacing utilities, color tokens, and current focus/interaction styles.
- Audit index.html to map current masthead/hero/section navigation structure and existing class names/BEM patterns.
- Inspect representative article files under articles/ to confirm metadata blocks, masthead/back-link patterns, and existing body typography structure.
- Read CLAUDE.md and the Tech Brief sections on Worker routing and relative-path constraints to ensure design outputs (asset URLs, icons, webfont imports) remain relative.
- Examine existing responsive rules and media queries in CSS (notably around ~800px and ~500px breakpoints) to align the refreshed scale.
- Review user flows research (issue hub and article flows) to validate visual hierarchy expectations on issue and article screens.
- Identify current focus/keyboard styles and any reduced-motion handling to determine where tokens or utilities need to be added or adjusted.

