### Technical Summary
Refresh the Proofbound Circular static magazine at `https://proofbound.com/circular` to deliver a modern, Substack-like browsing and reading experience—updating the shared design system, adding interactive issue navigation, standardizing article templates with in-issue continuation, and shipping a branded 404—while preserving static HTML delivery on DigitalOcean App Platform behind the **exact Cloudflare Worker proxy** that routes `/circular/*` traffic.

### System Design
#### Frontend (Static HTML/CSS/JS; Proofbound/circular)
- Architecture & constraints
    - Preserve the static-site delivery model (no backend on the static host).
    - Hosting/routing constraint (exact Worker behavior; must be treated as contract):
        - Applies only for marketing hostnames:
            - `proofbound.com`
            - `www.proofbound.com`
        - Match logic:
            - Worker computes `pathname = url.pathname.toLowerCase().replace(/\/$/, "")` for comparison (lowercased; single trailing slash trimmed).
            - If `pathname.startsWith("/circular")`, request is proxied to the DigitalOcean origin **`https://circular-n9vc9.ondigitalocean.app`** with `/circular` stripped (case-insensitive) and query string preserved.
                - Forwarded path is computed from the **original** `url.pathname` via `url.pathname.replace(/^\/circular/i, "") || "/"` (case-insensitive replace; preserves original case for the remainder of the path).
                - Proxy preserves `url.search` (query string).
                - Cache config sets `cf: { cacheEverything: false }`.
    - Implications for link structure and authored URLs
        - Enforce **relative** asset and link paths throughout generated HTML and authored content.
            - Avoid root-relative paths (`/css/...`) and absolute URLs for site-internal navigation where relative is feasible.
        - Trailing-slash normalization considerations:
            - The Worker trims a trailing `/` only for the *matching check*, but the forwarded request uses the **untrimmed original** `url.pathname` replacement.
            - Generated internal links should avoid relying on dual canonical forms (`/articles/foo` vs `/articles/foo/`) unless both are guaranteed to exist as static files; prefer a single consistent form in generated output.
        - Case sensitivity considerations:
            - Matching `/circular` is case-insensitive, but the remainder of the forwarded path preserves original case.
            - Because static file serving can be case-sensitive, generated links should use consistent, canonical casing for filenames/paths (and avoid producing mixed-case URLs).
        - Hash fragments (`#...`) are client-side only and do not reach the Worker; they must be handled purely by in-page JS/CSS/HTML.
    - Maintain the existing visual/style patterns already in use:
        - CSS tokens via `:root` custom properties.
        - BEM-like class naming conventions.
        - Responsive behavior aligned to the current breakpoints (~800px and ~500px).
        - Google Fonts imports in CSS (retain existing approach unless changed as part of the design refresh).

- Design system refresh (issue + article + 404)
    - Extend the existing CSS token system to ensure consistent typography, spacing, color, and interaction states across:
        - Issue landing page
        - Article pages
        - 404 page
    - Ensure interactive vs non-interactive states are clearly differentiated:
        - Link states (hover/focus/visited)
        - Button states (default/hover/focus/active/disabled where applicable)
        - Card affordances
    - Accessibility and motion
        - Maintain semantic landmark structure (header/nav/main/section/footer) consistent with current markup patterns.
        - Provide visible focus styles across interactive elements.
        - Respect reduced-motion preferences for smooth scrolling and microinteractions.
    - Responsive layout
        - Ensure layouts adapt cleanly across mobile/tablet/desktop without horizontal overflow.
        - Handle long titles/bylines/excerpts without breaking card grids or nav layouts.
    - Optional third-party modules (e.g., comments) must be styled to match and not degrade readability or layout when disabled.

#### Content Authoring & Build (Markdown + static generator)
- Introduce a minimal build pipeline to replace the current manual “edit HTML directly” workflow while keeping the output as a static HTML/CSS/JS bundle deployable on DigitalOcean static hosting.
- Static generator
    - Use a Node-based static generator that supports:
        - Markdown input
        - YAML frontmatter
        - Layout templates/partials
        - Simple collections/sorting
        - Output directory control
- Output structure (Worker + origin compatible)
    - Generated site output must match the runtime paths expected by the Worker/origin:
        - An `index.html` at the DigitalOcean origin root (served to `/circular` via the Worker).
        - `articles/<slug>.html` for each article.
        - `css/`, `images/`, and any `js/` assets served from the same origin root.
    - All generated links and asset references must be relative so they resolve correctly when `/circular` is stripped by the Worker and content is served from the origin root.
    - Generated output should standardize URL forms (no trailing slashes for file-like pages) to reduce ambiguity under the Worker’s match/forward split behavior.

#### YAML Frontmatter (source of truth for navigation + templates)
- Article source of truth
    - Articles are authored in Markdown with YAML frontmatter at the top.
    - Frontmatter drives:
        - Article page metadata rendering (e.g., section label, title/byline fields where present)
        - Issue landing page section membership and ordering
        - In-issue continuation (next/previous) and “Next up”
- Required/expected frontmatter fields
    - `issue`: identifier for the issue the article belongs to
    - `section`: section grouping used on the issue landing page (e.g., Analysis, Light Reading, About)
    - `order`: ordering key within an issue (used for next/previous)
- Reasonable defaults when frontmatter is missing/partial
    - If `order` is missing: order articles by alphabetical URL slug as the fallback.
    - If `issue`/`section` are missing: article still builds and renders cleanly; it may be omitted from issue landing page groupings unless it can be deterministically placed without inventing metadata.

#### Issue Page Interactions (TOC + section navigation)
- Table of Contents behavior
    - Clicking TOC items scrolls to the corresponding in-page anchors.
    - TOC highlights the currently viewed section while scrolling.
    - TOC supports expanding/collapsing section groups for long lists.
    - TOC remains easily accessible:
        - Sticky on desktop
        - Accessible entry point on mobile (lightweight, accessible toggle pattern)
- Active-state implementation
    - Use `IntersectionObserver` to compute the active section/article anchor.
    - Provide a fallback scroll listener for unsupported browsers.
- Smooth scrolling and deep links
    - Smooth scroll must avoid landing with headings hidden (account for sticky UI).
    - Hash deep links on load must scroll to the correct target and set active state.
- Edge handling
    - Missing anchors/mismatched IDs: disable the TOC item or fall back to the closest valid target without breaking navigation.
    - Rapid scrolling: stable active-state updates (avoid flicker).

#### Article Reading Experience (template + continuation)
- Consistent article template
    - Build-time template renders a shared header, typography rules, and metadata blocks consistent with the refreshed design system.
    - Provide persistent navigation back to the issue landing page (header link and/or breadcrumb), matching the existing “Back to the Circular” pattern.
- In-issue continuation
    - Next/previous navigation computed at build time based on:
        - `issue` filter
        - `order` within issue (fallback alphabetical slug)
    - “Next up” module shown to encourage continued reading within the same issue (based on the same ordering rules).
- Engagement modules (static-compatible)
    - Subscribe entry point near top of article (UI only; hosted integration deferred/undecided).
    - End-of-article share controls:
        - Share to X
        - Share to Facebook
        - Copy link with success feedback and keyboard accessibility
        - If canonical URL metadata is missing, use a stable page URL to avoid broken shares.
    - Optional comments area:
        - Controlled by a site-wide configuration/flag
        - Supports embed or link-out later; do not commit to a provider unless required
        - Must not delay initial readability; show a graceful fallback if blocked/unavailable and include a third-party privacy notice when enabled
- Edge handling
    - Missing author/date: render cleanly with no layout gaps.
    - Very short articles: continuation modules remain coherent and visible.
    - Clipboard blocked: provide a clear fallback instruction for manual copy.
    - External links: consistent styling and visited-state differentiation.

#### Hosted App Integration (entry points only in v1; state deferred)
- v1 constraint (explicit)
    - The static site must **not** attempt auth/subscription state detection.
    - Always show “Sign in” (top navigation) and “Subscribe” (near top of issue and article pages) as entry points.
    - Do not implement “Account”, “Subscribed” label, or “Manage” link UI until a hosted app exists and a state mechanism is defined.
- Configuration-first linking
    - Keep destinations for Sign in / Subscribe configurable so they can be wired to the hosted app later.
    - Return URL deep-links are a product requirement, but implementation details remain constrained by deferred hosted endpoints; do not add static-site state logic in this phase.

#### Branded 404 (DigitalOcean static hosting + Worker compatible)
- Add a root-level `404.html` on the DigitalOcean origin that:
    - Matches the refreshed design system and branding.
    - Explains the page may have moved/no longer exists.
    - Provides prominent links back to a safe entry point (issue landing page) and to the main sections.
    - Uses relative paths compatible with the Worker stripping `/circular`.
- Proxy-facing acceptance constraints for missing pages
    - Missing files under `/circular/*` should surface as the branded 404 experience served from the origin’s static 404 handling (not a generic nginx/Cloudflare error), to the extent supported by DigitalOcean static hosting.
    - Validate how the origin handles:
        - `/` vs `/index.html`
        - missing `articles/<slug>.html`
        - missing asset files
      and ensure the user-visible result through the Worker is the branded 404 page rather than a default error page.

#### Performance & Accessibility (cross-cutting)
- Performance
    - Keep JS lightweight; avoid heavy dependencies.
    - Ensure TOC highlighting and scroll-linked interactions do not introduce scroll jank.
    - Optional embeds (comments) must not block initial render/readability.
- Accessibility
    - Keyboard navigation for TOC, collapsible groups, share controls, and any mobile TOC entry must work without focus traps.
    - Visible focus styles and semantic headings/landmarks.
    - Reduced motion support for smooth scrolling and microinteractions.
    - Responsive images must not break layout.

### Data Model / Schema Changes
None