## Objective

Deliver a modern, delightful Substack-like browsing experience for Circular that keeps reading fully static while enabling subscriptions, identity, and lightweight engagement through integrated hosted services.

## Project Goal

Increase issue-page engagement by achieving a **+25% lift in average time on page** and a **+15% lift in article click-through (“Read →”)** within **30 days** of launch (vs. the prior 30-day baseline).

## User Journey

- Reader: Discover and browse (static)
    - Lands on the Circular landing/issue page (masthead/hero + issue metadata such as volume/number/season and editors)
    - Sees clear entry points to featured pieces plus section navigation (e.g., Analysis / Light Reading / About)
    - Uses an interactive Table of Contents to jump to sections and articles (with clear active-state highlighting and smooth scrolling)
    - Opens an article on a consistent article template (improved typography, spacing, responsive layout)
    - Continues browsing via next/previous navigation and/or “Next up” recommendations
    - Returns to issue page via persistent navigation/breadcrumbs; continues casual browsing without any forced funnel

- Reader: Subscribe (hybrid: static → hosted)
    - On issue and article pages, sees a **Subscribe** element near the top (default state when not subscribed)
    - Clicks **Subscribe** and is routed to a hosted subscription flow (on the existing DigitalOcean-hosted app and/or a hosted endpoint/service)
    - Provides email address for subscription capture (e.g., processed via **resend.com**)
    - After success, returns to the originating issue/article URL (return URL deep-link preserved)
    - Static site reflects subscription state:
        - **Subscribed** appears as a **non-clickable label**
        - A separate **Manage** link routes to the hosted subscription preferences page
    - If the reader is logged in but not subscribed:
        - **Subscribe** remains visible near the top
        - Identity state is handled independently (see below)

- Reader: Sign in / manage identity (hybrid: static → hosted)
    - Default state on the static site shows **Sign in** in top navigation
    - Reader initiates sign-in and completes login via hosted SSO (e.g., **Google / Apple / other providers**) on the DigitalOcean-hosted app
    - After success, returns to the originating issue/article URL (return URL deep-link preserved)
    - Static site reflects identity state in navigation:
        - **Account** replaces **Sign in**
    - Subscription and identity remain decoupled:
        - Logged in does not imply subscribed
        - Subscribed does not require login (unless enforced later)

- Reader: Engage with content (static-compatible)
    - At the end of each article, sees share controls:
        - Share to **X**
        - Share to **Facebook**
        - Copy link (clipboard + success feedback)
    - Optionally sees an embedded third-party comments widget on article pages (e.g., Disqus) if enabled, or routes to a hosted comments experience

- Reader: Encounters broken/dead content
    - Hits an invalid URL (currently a generic nginx 404)
    - Sees a branded 404 page with helpful explanation and prominent links back to home/latest issue/sections
    - Re-enters the browsing flow without bouncing

## Features 

### In Scope
- Static-first architecture
- Design system refresh
- Responsive typography layout
- Interactive issue TOC
- Consistent article template
- Branded 404 page
- Top-of-page Subscribe
- Hosted subscribe flow
- Resend email capture
- SSO login (Google/Apple)
- Hosted app integration
- Return URL deep-links
- Nav “Account” state
- “Subscribed” label state
- Separate “Manage” link
- End-of-article sharing
- X/Facebook share
- Copy link button
- Optional Disqus comments

### Out of Scope
- Backend on static host
- Self-hosted comments moderation
- Native mobile apps
- Custom subscription admin UI