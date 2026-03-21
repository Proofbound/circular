### User Story
As a reader, I want a modern, polished visual design across Circular so that the site feels premium, readable, and enjoyable to browse.

### Acceptance Criteria
- Site uses a consistent design system across issue, article, and 404 pages (typography, spacing, colors, buttons, links, cards).
- Issue landing page presents a clear visual hierarchy: masthead/hero, issue metadata, featured items, and section navigation.
- Interactive and non-interactive states are visually distinct (hover, focus, active, visited) across links and buttons.
- Layout adapts cleanly across mobile, tablet, and desktop without horizontal scrolling or overlapping elements.
- All pages meet baseline accessibility expectations: readable contrast, visible keyboard focus, and semantic headings.

### Dependencies
- None

### Edge Cases & Handling
- Very long article titles/authors: gracefully wrap and truncate where appropriate without breaking layout.
- Missing excerpts or metadata: cards and lists still render consistently with sensible spacing.
- Users with reduced motion enabled: animations are minimized while keeping usability intact.
