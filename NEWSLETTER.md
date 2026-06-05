# Sending a Circular Newsletter

How to email a new issue to subscribers. The send pipeline is **live in production**. Authoring is manual (you write a digest by hand); dispatch is automatic (committing the file triggers a GitHub Actions workflow). There is intentionally **no generator** that builds the email from `src/articles/` — you write the digest yourself.

## Where the machinery lives

Everything that *sends* mail lives in **`proofbound-monorepo`**, not in this repo:

- **Content source:** `content/newsletters/circular/` — one markdown file per send. See that directory's `README.md` for the authoritative contract.
- **Dispatch workflow:** `.github/workflows/newsletter-dispatch.yml` ("Dispatch Circular newsletter").
- **Send endpoint:** `POST /v1/platform/email/send-newsletter` (service-token gated) in `cc-template-api`. It seals the active audience for `product='circular'`, fans out per-recipient via the `send-notification` Edge Function → Resend (`Circular <circular@proofbound.com>`), auto-injects a per-recipient unsubscribe footer, and is resume/idempotency-safe.

Circular itself (this repo) owns **zero** send code. It only collects subscribers via the subscribe form.

## How to send an issue (manual flow)

1. In the **monorepo**, create `content/newsletters/circular/YYYY-MM-DD-slug.md`.
2. The **first line** is `# Subject line` — it becomes both the email subject and the lead `<h1>`.
3. Write the body as a digest (see template below). Use absolute `https://proofbound.com/circular/...` links.
4. **Do not** add an unsubscribe footer — the Edge Function injects a per-recipient one.
5. Commit & push to `master`. The workflow auto-dispatches on the new `content/newsletters/circular/*.md` file.
   - Or trigger manually: Actions tab → **Dispatch Circular newsletter** → **Run workflow** → paste the file path.
6. To **re-send** or correct, commit a **new dated file**. Never edit an already-sent file to resend (see idempotency caveat below).

## Digest template (issue digest + links)

The agreed email format is a short digest: cover headline + dek, then a linked table of contents back to the full articles on the site. Pull titles, deks, and slugs from the issue's `src/articles/<issue>/*.md` frontmatter. Each article resolves to `https://proofbound.com/circular/articles/<fileSlug>.html` (matches the `permalink` in article frontmatter — `<fileSlug>` is the markdown filename without `.md`).

```markdown
# The Fortnightly Circular — Vol. I, No. 1

*A new issue is out.* Our cover story this fortnight:

## [Iran, Give Me My Country Back](https://proofbound.com/circular/articles/iran-give-me-my-country-back.html)
A Lebanese architect in exile since 1984 argues that the price of Tehran's grip on Beirut is measured in lost decades, captured institutions, and a country no longer answerable to its own people.

### Also in this issue
- [Nowruz vs. the Mahdi](https://proofbound.com/circular/articles/nowruz-vs-the-mahdi.html) — Iran's ancient spring festival and its messianic state religion are in a civilizational contest.
- [When Every LLM Says "Buy"](https://proofbound.com/circular/articles/when-every-llm-says-buy.html) — If four leading AI systems unanimously recommend the same stock, has the research told you anything at all?
- [When AI Prose Is Worth Reading](https://proofbound.com/circular/articles/when-ai-prose-is-worth-reading.html) — The question is not who wrote the words, but whether someone with judgment directed the work.

[Read the full issue →](https://proofbound.com/circular/)
```

(The example above uses real `vol1-no1` articles in reading order. Trim or extend "Also in this issue" to taste — the format is a guideline, not a fixed list length.)

## Verifying a send

Query the dispatch log (Supabase project `zvyyutihtztvlnnhzoah`):

```sql
select status, success_count, failure_count, created_at
from public.newsletter_dispatches
order by created_at desc;
```

Each row in `newsletter_dispatches` is one send (subject, HTML, counts). The per-recipient detail lives in `public.newsletter_dispatch_recipients` (`dispatch_id`, `email`, `status`, `error`, `sent_at`) — when a send starts, the then-active audience is *sealed* into this table, and the dispatch fans out against that frozen list. To see exactly who failed and why on a given send:

```sql
select email, status, error, sent_at
from public.newsletter_dispatch_recipients
where dispatch_id = '<dispatch-uuid>' and status <> 'sent';
```

Retry semantics: a `completed` dispatch is a no-op on re-run; a `partial` dispatch retries **only the failed recipients** — it walks the sealed `newsletter_dispatch_recipients` rows (not the live `email_subscriptions` list), so someone subscribing or unsubscribing after the send started doesn't change who that send targets.

## Idempotency caveat

The workflow's idempotency key is `${commit_sha}:${file_path}`.

- Re-running the **same** workflow run (or re-pushing the same commit) is safe — same key, no duplicate send.
- A **manual `workflow_dispatch` of an older newsletter file from a newer commit** gets a *new* key and **will re-send** to everyone. Do not manually dispatch a file that was already sent. For a genuine re-send, commit a new dated file.

## Testing tip

There is currently one real subscriber (`sprague@outlook.com`), so a live send is a safe end-to-end self-test: author a short test digest, dispatch it, and confirm the email arrives with the injected unsubscribe footer plus a `completed` row in `newsletter_dispatches`.
