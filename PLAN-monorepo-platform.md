# Platform API — Monorepo Integration Instructions

**Last Updated**: April 10, 2026
**Scope**: Cross-product platform endpoints in the ProofBound monorepo
**Status**: **Phase 1 implemented** in cc-template-api (port 8001). Migration staged but not yet applied to the linked Supabase database — run `supabase db push` from `shared/` to apply. Phase 2 (newsletter dispatch) remains deferred.

## Phase 1 — Client Integration Guide (for Circular and other products)

Circular and other ProofBound products can now hit these endpoints:

### Base URL

- **Production**: `https://api.proofbound.com` (nginx proxies to cc-template-api)
- **Local dev**: `http://localhost:8001`
- CORS origin `http://localhost:8080` is allowlisted for Circular local dev. Production Circular is served from `https://proofbound.com/circular` which is already allowlisted.

### Endpoints

**`GET /v1/platform/health`** — no auth required

```
→ 200 { "status": "ok", "service": "platform" }
```

**`POST /v1/platform/subscribe`** — no auth required, rate-limited 10/minute per IP

```json
Request:
{
  "email": "user@example.com",          // required, validated, max 128 chars
  "product": "circular",                // required, 1–64 chars
  "turnstile_token": "...",             // optional — required in prod when TURNSTILE_SECRET_KEY is set
  "website": ""                         // honeypot — MUST be empty; non-empty silently drops
}

→ 200 { "status": "subscribed" | "already_subscribed", "email": "...", "product": "..." }
→ 400 { "detail": "captcha_verification_failed" }
→ 422 (Pydantic validation failure — bad email shape, missing product, etc.)
→ 429 { "detail": "Rate limit exceeded: 10 per 1 minute" }
```

**`POST /v1/platform/unsubscribe`** — no auth required, rate-limited 30/minute per IP, idempotent

```json
Request:
{ "email": "user@example.com", "product": "circular" }

→ 200 { "status": "unsubscribed" }   // even if no matching row existed
→ 429 { "detail": "..." }
```

### Client implementation notes for Circular

1. **Auth stays client-side.** Use the Supabase JS SDK directly for login/signup/session — same Supabase project, same anon key as the book app. The platform API does not wrap auth.
2. **Anonymous subscribe works.** No `Authorization` header needed. Emails without accounts are stored with `user_id = NULL` and backfilled automatically when a matching `auth.users` row is detected.
3. **Honeypot**: include a hidden `<input name="website">` in the signup form and pass its value as `website` in the JSON body. Bots that fill it get a fake success response.
4. **Turnstile** (required in production): add a Cloudflare Turnstile widget to the subscribe form and pass the token as `turnstile_token`. When `TURNSTILE_SECRET_KEY` is unset on the server, verification is skipped (dev-friendly).
5. **Unsubscribe links**: safe to call from plain email links — no auth, idempotent, returns 200 even for unknown emails so stale links never error.
6. **Rate limits** are per-IP via `slowapi`. Legitimate users won't hit them; scrapers will.
7. **TypeScript types**: bundled OpenAPI schema is at `openapi.yml` in the monorepo root; generated TS types land in `apps/main-app/frontend/src/types/api-generated.ts`. Copy the relevant `components["schemas"]["Platform*"]` interfaces into Circular, or import from the bundled spec.

---

## Overview

The monorepo currently serves the book-generation app exclusively. This work adds a **platform API** — a small set of endpoints that any ProofBound product (book app, Circular magazine, TextKeep, future products) can call for shared services: email subscriptions and email dispatch.

Auth is NOT part of the platform API. All ProofBound products use the Supabase JS client directly for signup/login/session management. The platform API only handles things that require server-side logic or service-role credentials.

> **Naming note:** "Subscriptions" in this doc means _email/newsletter subscriptions_ (subscribe to a mailing list). This is distinct from the existing `shared/python/proofbound_shared/plans/` module which handles _paid plan subscriptions_ (credits, billing tiers, Stripe). The database table is named `email_subscriptions` to avoid confusion.

## Architecture Decisions

### What the platform API provides

1. **Email subscriptions** — product-agnostic email subscription management (subscribe, unsubscribe, list)
2. **Email dispatch** — trigger newsletter sends via the existing Supabase Edge Function + Resend pipeline
3. **Health check** — simple endpoint for client connectivity verification

### What the platform API does NOT provide

- **Auth** — clients use Supabase JS SDK directly (same project, same anon key)
- **Product-specific logic** — book generation, Lulu print, cover generation stay in their existing services
- **Storage** — each product manages its own R2 buckets
- **Stripe billing** — per-product checkout logic stays in each product's own routes

### Why these boundaries

Shared auth is already solved by Supabase (client-side SDK, no server wrapper needed). The only things that require a server-side API are operations needing the Supabase service-role key (subscription management) or coordination with external services (Resend). Everything else is either product-specific or already handled client-side.

## Implementation Plan

### 1. Database: `email_subscriptions` table ✅ IMPLEMENTED

Migration file: `shared/supabase/migrations/20260410215557_create_email_subscriptions.sql` (created via `supabase migration new create_email_subscriptions`). **Not yet applied to the linked DB** — run `cd shared && supabase db push` when ready.

```sql
-- =============================================================================
-- Migration: Create email_subscriptions table
-- Created: 2026-04-08
-- Purpose: Product-agnostic email/newsletter subscription management for the
--          platform API. Supports anonymous (no account) subscriptions with
--          optional user_id backfill when subscribers later create accounts.
-- Impact: New table, no existing tables or views affected.
-- =============================================================================

CREATE TABLE public.email_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    product TEXT NOT NULL,                          -- 'circular', 'bookapp', 'textkeep', etc.
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'unsubscribed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    unsubscribed_at TIMESTAMPTZ,
    UNIQUE(email, product)
);

-- Allow anonymous subscriptions (user_id nullable).
-- When a subscriber later creates an account, backfill user_id:
--   UPDATE email_subscriptions SET user_id = '<uuid>' WHERE email = '<email>' AND user_id IS NULL;

-- RLS: service-role only (platform API uses service-role key)
ALTER TABLE public.email_subscriptions ENABLE ROW LEVEL SECURITY;

-- No public policies — only service-role key can read/write.
-- If you later want users to manage their own subscriptions client-side,
-- add a policy: USING (auth.uid() = user_id)

-- Index for email lookups
CREATE INDEX idx_email_subscriptions_email ON public.email_subscriptions(email);
CREATE INDEX idx_email_subscriptions_product_status ON public.email_subscriptions(product, status);
```

**Key design choice**: `user_id` is nullable. This allows email-only subscriptions before account creation. The platform API backfills `user_id` when it detects a matching email in `auth.users`. This is a standard newsletter-first pattern.

### 2. FastAPI Router: `/v1/platform/` ✅ IMPLEMENTED

Files created inside cc-template-api:

- `packages/cc-template-api/cc_template_api/routers/platform.py` — APIRouter with health / subscribe / unsubscribe
- `packages/cc-template-api/cc_template_api/services/platform_service.py` — `PlatformService` + `EmailSubscriptionRepository` (extends `BaseRepository` from `proofbound_shared.database`)
- `packages/cc-template-api/cc_template_api/models/platform.py` — Pydantic `Platform*` models using `EmailStr`

Wiring:

- Router mounted in `packages/cc-template-api/cc_template_api/__init__.py` alongside the existing routers (no new port, container, or nginx upstream).
- `/v1/platform/health`, `/v1/platform/subscribe`, `/v1/platform/unsubscribe` added to `UNPROTECTED_PATHS` in `packages/cc-template-api/cc_template_api/middleware/hybrid_auth.py`.
- `pydantic[email]` added to `packages/cc-template-api/pyproject.toml` so `EmailStr` works.

Phase 2 (`send-newsletter`) still stays behind the service-token gate — see §3.

### 3. Endpoints ✅ IMPLEMENTED (Phase 1 only)

#### `GET /v1/platform/health` ✅

Simple connectivity check. Returns `{"status": "ok", "service": "platform"}`. No auth required. Used by Circular's `circular.js` to show the green connection indicator.

#### `POST /v1/platform/subscribe` ✅

```python
# schemas.py
class SubscribeRequest(BaseModel):
    email: EmailStr
    product: str  # 'circular', 'bookapp', etc.

class SubscribeResponse(BaseModel):
    status: str   # 'subscribed', 'already_subscribed'
    email: str
    product: str
```

Logic:

1. Validate email format (Pydantic handles this)
2. UPSERT into `email_subscriptions` table (on conflict `(email, product)`, set `status = 'active'`, clear `unsubscribed_at`)
3. If a `auth.users` row exists with this email, backfill `user_id`
4. Return status

No auth required — anonymous subscription must work (newsletter signup form).

#### `POST /v1/platform/unsubscribe` ✅

```python
class UnsubscribeRequest(BaseModel):
    email: EmailStr
    product: str
```

Logic:

1. UPDATE `email_subscriptions` SET `status = 'unsubscribed'`, `unsubscribed_at = now()` WHERE `email` and `product` match
2. Return 200 even if no row found (idempotent)

No auth required — unsubscribe links in emails must work without login.

#### Abuse controls for public endpoints ✅ IMPLEMENTED

All five controls wired in `routers/platform.py` and `services/platform_service.py`:

1. **Rate limiting** — `@limiter.limit("10/minute")` on subscribe, `@limiter.limit("30/minute")` on unsubscribe, keyed per-IP via the existing `cc_template_api/middleware/rate_limit.py` limiter.
2. **Cloudflare Turnstile** — `PlatformService.verify_turnstile()` calls `https://challenges.cloudflare.com/turnstile/v0/siteverify`. **Gated by `TURNSTILE_SECRET_KEY` env var**: when unset the check is skipped (dev-friendly); when set, a missing or failing token returns `400 captcha_verification_failed`. Unsubscribe is exempt.
3. **Email format validation** — Pydantic `EmailStr` in `models/platform.py`.
4. **Honeypot field** — `website: Optional[str]` in `PlatformSubscribeRequest`. If non-empty the router returns a fake success response without hitting the DB or calling Turnstile.
5. **Upper bound on email length** — `Field(..., max_length=128)` on both subscribe and unsubscribe models.

**Production checklist**: set `TURNSTILE_SECRET_KEY` on the cc-template-api container or the service will silently accept any subscribe request.

#### `POST /v1/platform/email/send-newsletter` (service-token only) ⏸ DEFERRED — Phase 2

Trigger a newsletter send for a given product. This endpoint requires the `API_ACCESS_TOKEN` bearer token (service-token auth). There is no admin role in the current auth middleware — `HybridAuthMiddleware` only distinguishes service-token (`request.state.user_id = None`) from user JWT. Service-token-only is the correct gate here; do not invent role enforcement for this.

```python
class SendNewsletterRequest(BaseModel):
    product: str              # 'circular'
    subject: str
    html_content: str         # The newsletter HTML body
    # OR: template + data, if you want server-side templating
```

Logic:

1. Query `email_subscriptions` WHERE `product = <product>` AND `status = 'active'`
2. For each subscriber, call the existing Supabase Edge Function (`send-notification`) with a new type `circular_newsletter`
3. Batch sensibly (Resend rate limits apply)

**Alternative**: Call Resend directly from this endpoint instead of going through the Edge Function. The Edge Function route reuses existing infra and logging; direct Resend is simpler. Either works — pick based on whether you want newsletter sends tracked in the `notifications` table.

### 4. Email Dispatch — Edge Function vs Direct Resend ⏸ DEFERRED — Phase 2

The existing Edge Function (`shared/supabase/functions/send-notification/index.ts`) is designed for **single-recipient transactional or anonymous sends** (line ~62). Each invocation handles one email to one recipient. It is not a bulk-send pipeline.

Using it for newsletter delivery means the `send-newsletter` endpoint must loop over active subscribers and invoke the Edge Function once per recipient. This works at small scale (dozens of subscribers) but has real operational implications:

- **Resend rate limits** apply per-call
- **Edge Function cold starts** compound with subscriber count
- **No retry/dead-letter** — a mid-batch failure leaves partial sends with no record of who received what
- **Timeout risk** — the FastAPI endpoint could time out before the loop completes

**Two options:**

**Option A: Edge Function route (small scale, ≤100 subscribers)**
Add `circular_newsletter` as an anonymous email type. The `send-newsletter` endpoint loops and calls the Edge Function per subscriber. Good enough for early Circular launches. Changes needed:

- Update the type union (line ~11)
- Add to the anonymous dispatch path (no user_id, no notification record)
- Add cases in `generateEmailContent`, `getNotificationTitle`, `getNotificationMessage`

**Option B: Direct Resend from Python (recommended for production)**
Call the Resend API directly from `platform_service.py`, bypassing the Edge Function entirely. Resend's batch API (`POST /emails/batch`) handles up to 100 recipients per call. This gives the Python service full control over batching, retries, and error tracking. Skips Edge Function cold starts.

**Recommendation**: Start with Option A for simplicity. Move to Option B when subscriber count or reliability requirements grow. Either way, verify `circular@proofbound.com` is authorized in Resend domain config.

### 5. OpenAPI Spec Update ✅ IMPLEMENTED

Add the platform routes to the modular OpenAPI spec. The actual structure uses flat service files (not nested `paths/` directories). The bundler at `openapi/scripts/bundle.sh` automatically merges all `services/*.yml` files:

```
openapi/
├── services/
│   ├── platform.yml              # NEW — all platform endpoint paths
│   ├── cc-template-api-core.yml  # existing
│   └── ...                       # existing service files
├── components/
│   └── schemas/
│       └── platform.yml          # NEW — SubscribeRequest, SubscribeResponse, etc.
└── base.yml                      # metadata, security schemes, tags
```

Add a `platform` tag to `openapi/base.yml` in the tags section.

**Security override required**: `openapi/base.yml` declares a global `security: [{ BearerAuth: [] }]` that applies to every operation by default. The public platform endpoints (`health`, `subscribe`, `unsubscribe`) must explicitly override this with an empty security array on each operation:

```yaml
/v1/platform/subscribe:
  post:
    tags: [platform]
    security: [] # override global BearerAuth — this endpoint is public
    requestBody: ...
    responses: ...
```

The `send-newsletter` operation inherits the default `BearerAuth` (no override needed) since it requires the service token.

Files created:

- `openapi/services/platform.yml` — three Phase 1 operations, each with explicit `security: []` override
- `openapi/components/schemas/platform.yml` — `PlatformHealthResponse`, `PlatformSubscribeRequest/Response`, `PlatformUnsubscribeRequest/Response`, `PlatformErrorResponse`
- `platform` tag added to `openapi/base.yml`
- `openapi.yml` (bundled) and `apps/main-app/frontend/src/types/api-generated.ts` regenerated via `./scripts/update-openapi.sh`.

### 6. CORS Update ✅ IMPLEMENTED

`http://localhost:8080` added to `CORS_ALLOWED_ORIGINS_DEFAULT` in `packages/cc-template-api/cc_template_api/constants.py` for Circular local development. Production Circular is served from `https://proofbound.com/circular`, which was already allowlisted.

## Integration Sequence

Ship in two phases. Phase 1 is the subscription slice — it unblocks Circular's migration off Netlify/Firebase immediately. Phase 2 is newsletter dispatch, which carries real operational complexity and should not hold up phase 1.

### Phase 1 — Subscription slice + health

Server-side work is **complete and merged on branch `infra`**. Remaining steps are deployment and the Circular-side client integration.

1. ✅ **Create the `email_subscriptions` table** via Supabase migration (`20260410215557_create_email_subscriptions.sql`)
2. ✅ **Write the OpenAPI spec** for `/v1/platform/health|subscribe|unsubscribe` with `security: []` override
3. ✅ **Implement platform modules** — router, service, models inside cc-template-api
4. ✅ **Mount the router** in `cc_template_api/__init__.py` and add unprotected paths to `hybrid_auth.py`
5. ✅ **Wire abuse controls** — slowapi rate limits, Turnstile verification, honeypot, 128-char email cap
6. ✅ **Add localhost:8080 to CORS** in `cc_template_api/constants.py`
7. ✅ **Tests** — 23 new unit tests (`test_platform_router.py`, `test_platform_service.py`), full cc-template-api unit suite green (714 tests)
8. ⏳ **Apply the migration** — `cd shared && supabase db push` (staged, awaiting explicit run)
9. ⏳ **Set `TURNSTILE_SECRET_KEY`** on the production cc-template-api container (without it, any subscribe request is accepted)
10. ⏳ **Deploy to droplet** — subscribe/unsubscribe/health go live
11. ⏳ **Update Circular's `circular.js`** — replace Netlify/Firebase signup with `POST /v1/platform/subscribe`; auth via Supabase JS SDK (see "Client Integration Guide" at the top of this doc)
12. ⏳ **Test end-to-end** — subscribe, verify in DB, verify unsubscribe idempotency
13. ⏳ **Delete Circular's Netlify site and Firebase project**

### Phase 2 — Newsletter dispatch (deferred)

Deferred until phase 1 is proven in production and subscriber counts justify the operational work. Newsletter dispatch requires either extending the `send-notification` Edge Function (which is currently designed for single-recipient transactional sends, see §4) or calling Resend's batch API directly from Python. Either path needs batching, retry handling, and partial-failure accounting that phase 1 does not.

Until phase 2 ships, newsletter sends are done manually (Resend dashboard, Mailchimp, or a one-off script reading from `email_subscriptions`).

1. Decide Option A (Edge Function per-recipient loop) vs Option B (direct Resend batch API)
2. Implement `POST /v1/platform/email/send-newsletter` with service-token gate
3. Add OpenAPI spec for the endpoint (inherits global `BearerAuth` — no override)
4. If Option A: update the Edge Function type union and dispatch logic
5. Deploy and send a test newsletter to a small allowlisted audience first

## Critical Rules

1. **OpenAPI first.** Write the spec before implementing the endpoints. Run `./scripts/update-openapi.sh` after any spec change.
2. **No new ports.** The platform router mounts in cc-template-api (port 8001). Do not create a separate service or Docker container.
3. **No auth for public endpoints.** Subscribe, unsubscribe, and health require no auth token. Send-newsletter requires the `API_ACCESS_TOKEN` service token (not a user JWT, not an admin role — the middleware has no role concept). Auth middleware bypass paths must be configured in `hybrid_auth.py`.
4. **Service-role key for DB access.** The platform API uses the Supabase service-role key (via `get_supabase_client()` from `proofbound_shared.supabase`) to manage email subscriptions. It does not go through RLS — it's a trusted backend service. Use the `BaseRepository` pattern from `shared/python/proofbound_shared/database/base.py` for consistency with other services.
5. **Anonymous subscriptions must work.** The subscribe endpoint requires no auth token. Email-only signup is a hard requirement.
6. **Idempotent unsubscribe.** Unsubscribe returns 200 even if no matching row exists. Unsubscribe links in emails must never error.
7. **Existing email infra.** Newsletter dispatch uses the existing Resend pipeline. Start with the Edge Function route for small scale; move to direct Resend batch API from Python when subscriber count grows. Do not add a second email provider.
8. **No breaking changes.** The platform router and modules are new, but this work does modify existing surfaces: `hybrid_auth.py` gains unprotected paths, `constants.py` gains a CORS origin, and (phase 2) the `send-notification` Edge Function gains a new email type. All changes are backward-compatible additions — no existing routes, tables, schemas, or behaviors are removed or altered.

## Testing ✅ IMPLEMENTED (Phase 1)

Test files:

- `packages/cc-template-api/tests/unit/routers/test_platform_router.py` — 12 tests covering health, subscribe (new, already-subscribed, invalid email, missing product, honeypot, captcha failure), unsubscribe (idempotent + unknown-email), and auth-bypass parametrized across all three endpoints.
- `packages/cc-template-api/tests/unit/services/test_platform_service.py` — 11 tests covering `EmailSubscriptionRepository` (new / existing active / reactivation / unsubscribe update + noop) and `PlatformService` Turnstile verification (skipped when secret missing, fails when token missing, success, failure) and email normalization.

Run locally:

```bash
cd packages/cc-template-api
uv run --active pytest tests/unit/routers/test_platform_router.py tests/unit/services/test_platform_service.py -v
```

Phase 2 (newsletter send) tests will need to mock the Edge Function call or Resend batch API — not written yet.

## Future Extensions (not in scope now)

- `GET /v1/platform/email-subscriptions?product=circular` — list subscribers (admin)
- `POST /v1/platform/subscribe/backfill` — batch backfill `user_id` for existing subscribers who later create accounts
- Stripe customer management (shared customer identity across products)
- Email subscription preferences (frequency, topics) per product
