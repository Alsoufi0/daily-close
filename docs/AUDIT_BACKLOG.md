# Audit Backlog

Single source of truth for the architectural audit performed 2026-05-26
and everything that's happened against it since. Update this file
whenever an item ships, gets paused, or is added.

The full original audit lives in chat history; this file is the
operational tracker.

---

## ✅ Shipped to `staging`

| Commit | Audit ref | What |
|---|---|---|
| `a5a3c17` | #2 CRITICAL | Removed demo-mode backdoors (API guard, mobile demo buttons, web demo fallback). Startup gate refuses to boot if `ALLOW_DEMO_AUTH` is truthy. |
| `3283032` | #3 CRITICAL | Idempotency on `/daily-close/finish` — DB column + service dedup + mobile/web client UUIDs. Defensive fallback if migration 005 hasn't run. |
| `703c6ff` | #8 + #4.2 + #10 partial | `SubscriptionGuard` on every DailyClose write endpoint; cron secret fail-closed in prod; mandatory Sentry in prod; optional healthcheck heartbeat URLs. |
| `0d83eb6` | #4 | First CI workflow — typecheck + 73 tests on every push to main/staging and every PR. |
| `8ede247` | #7.2 | i18n sweep #1 — routed ~50 hardcoded English strings through `t()` across mobile + web + 4 locales. |
| `1aac076` | UX polish | Persistent idempotency key on `useRef`; web global 402 → `/billing` redirect. |
| `2f519b7` | #7.2 | i18n sweep #2 — `/setup` and `/billing` page strings + dynamic rules for "Welcome, X." and "{N} days left in trial." |
| `baee5a1` | #5 | Quick wins bundle: `@nestjs/throttler` on /auth/*, mobile a11y labels, modal in place of `window.confirm()`, dashboard polling 15s → 30s. |
| `e74b53d` | #2.1 CRITICAL | Web auth migrated from `localStorage` JWT to `@supabase/ssr` cookie-backed sessions + Next.js middleware refresh + origin-check CSRF middleware. |
| `8508be0` | #5 phase 1 | Mobile offline phase 1 — AsyncStorage persistence of in-progress close, restore on cold start with 24h staleness + store-mismatch safety. |
| `82a05a3` | #5 phase 2 | Mobile offline phase 2 — outbox queue with exponential backoff, AppState-driven drain, `QueuedForRetryError` marker. |
| `46a9d86` | #5 phase 3 | Mobile offline phase 3 — NetInfo banner, reconnect-driven drain, pending-count badge. |
| `17edd18` | UX bug | `formatMoneyExact` + `toMoney` parser — fixes "-$1,169 phantom shortage on matched close" and "short -$0 in red" issues. |
| `a2ff94a` | post-fix-#2 | Softened `ALLOW_DEMO_AUTH` boot gate (only FATAL on truthy values, tolerates legacy `"false"`). |
| `6f9d945` | PDF rendering | Bundled Noto Sans (Latin + Arabic + Devanagari) via `@pdf-lib/fontkit` for proper Arabic/Hindi report rendering. Killed the `?`-replacement sanitizer. |
| `3a8d7f7` | observability | `AllExceptionsFilter` — every 500 logs full stack to stdout so Render's log tail surfaces the actual cause. Optional Sentry capture. |
| `47a7f98` (partner) | post-PDF | Moved `regenerator-runtime` to root dependency so Docker runtime stage carries it. |
| `ac88a32` (partner) | upload 500 | OCR.space log sanitised — no longer dumps the entire base64 image to stdout (which was crashing the container). |
| `a203301` | docs | This file (AUDIT_BACKLOG.md) created so audit progress isn't trapped in chat history. |
| `e4922a1` (partner) | upload 500 round 2 | Owner-as-employee row now relinks instead of creating a duplicate. Was blocking uploads for any owner that had previously closed a different store (Employee.userId is UNIQUE, so the second create() crashed with 500). Superseded by `bd57fcd` Phase 1 (constraint dropped entirely). |
| `2e34d14` | docs | Documented the owner-as-employee debt in this file. |
| `47a7f98` (partner) | post-PDF deploy | Moved `regenerator-runtime` to root package.json so the Docker runtime stage carries it. |
| `ac88a32` (partner) | upload 500 round 3 | OCR.space log sanitised — was dumping the entire base64 image to stdout, crashing the Render container. |
| `bd57fcd` | #9 partial + own-debt | **Phase 1 of multi-store assignments**: reshaped `employees` from "one row per user" to "one row per (user, store, role)". Migration 006 adds `role` enum + `daily_close.submitted_by_user_id`, drops UNIQUE on user_id, adds (user_id, store_id) composite UNIQUE, backfills owner OWNER-role rows and submitted_by_user_id. API: `assertCanCloseStore` now assignment-based, no wandering. New endpoints: `POST /employees/:id/assignments`, `GET /employees/by-user/:userId/assignments`. **Replaces** the e4922a1 hack. |
| `d034b56` | Phase 2 of multi-store | Web `/admin/employees` page grouped by user, each employee shows store chips with per-chip remove + "Assign to another store" modal. |
| `360624d` | Phase 3 of multi-store | Mobile store picker on the close screen — hidden when single-store, opens a sheet when multi-store. Persisted across launches via AsyncStorage. `stores.listForUser` now returns ALL assigned stores for employees (was only the primary). |
| (this commit) | #7 partial (date drift) | **Close-date bug fix.** `daily_close.date` was a Postgres `date` (date-only) in migration 001 while Prisma + all day-range code treat it as a timestamp. Against a date-only column Postgres truncated the guard's UTC-instant range bounds, so a late-night close stored under one calendar date falsely matched the *next* day's close attempt → "This store is already closed for this date" even though the dashboard (which filters in full-precision JS) correctly showed it as needing a close. Migration 007 converts the column to `timestamptz`; Prisma field annotated `@db.Timestamptz(3)`. **Partner must apply migration 007 to staging Supabase.** |

---

## ⏸️ Paused (awaiting decision)

### #1 — Stripe webhook signature verification (CRITICAL security)
- **Current state:** `subscriptions.controller.ts` reads the signature header but doesn't validate it with `stripe.webhooks.constructEvent`. Any forged POST can flip a customer to ACTIVE.
- **Blocker:** user decision on whether to keep Stripe at all vs. switch to a different billing provider.
- **Estimate:** 2 hours once unpaused.

---

## 🔴 Remaining Top-10 audit items

### #6 — Queue worker for WhatsApp + Resend + cron sends
- Currently inline; weekly summary loop is sequential per-owner (~1.4h at 5k owners).
- Needs Redis service on Render + BullMQ + worker dyno.
- **Partner action:** add Redis on Render dashboard (one-time).
- **Estimate:** 3–4 days of code work after Redis exists.

### #7 — Resolve dual-schema problem (Prisma vs Supabase SQL)
- Both files currently define schema; they've drifted (e.g. `date` column type).
- **Decision needed:** pick one as canonical (recommend Prisma).
- **Estimate:** 3 days code, then partner needs to apply migrations.

### #9 — Organization layer in data model
- Currently Owner → Stores. Blocks franchise / enterprise / multi-owner.
- **1 day NOW vs. 1 quarter LATER** as row counts grow.
- **Decision needed:** approval to add `Organization` table + migrate.

### #10 partial — Real backups
- Sentry: code-side mandatory in prod (done).
- Supabase PITR: NOT enabled. ~$10/mo, dashboard click.
- Off-site bucket backup: not configured.
- **Partner action:** enable Supabase PITR.

---

## ⚠️ Pending tactical / polish items

### Owner-as-employee data model (newly discovered structural debt)
- `daily_close.employee_id` is a NOT NULL foreign key to `employees`, so
  when an OWNER closes a store (not an employee), the code synthesises a
  fake employee row linking `user.id → store.id`.
- `employee.user_id` is `UNIQUE`, so any given owner can have at most ONE
  employee row at any time. Commit `e4922a1` works around this by
  *relinking* the existing row's storeId when an owner closes a different
  store than last time.
- **What this papers over:**
  - Race conditions when an owner closes two stores in parallel (two
    relink updates collide)
  - Audit trail oddities — historical daily_close rows still reference
    the same employee.id, but if you query "what store is this employee
    currently at?" you get the most recently closed one, not the historic
    truth.
  - Doesn't scale to franchise / district manager / multi-owner stores.
- **The proper fix** lives inside audit item #9 (Organization layer)
  below. Two clean options:
  - Drop `UNIQUE` on `employee.user_id`. Allows multi-store employees.
    Cheap migration today, structurally correct.
  - Make `daily_close.employee_id` nullable + add `submitted_by_user_id`
    so closes are owned by USERS, not by synthesised employee rows.
    Cleaner conceptually, slightly bigger migration.
- **Worth doing within a few weeks** — pairs naturally with #9.

### Architectural i18n rewrite
- The `MutationObserver` + `phraseKeys` approach in `apps/web/components/language-provider.tsx` is fragile (audit #7.1). Every new string requires manual addition; whack-a-mole patches have happened twice already.
- **Right fix:** `next-intl` (web) + `i18next` (mobile), per-locale JSON files, missing-key telemetry.
- **Estimate:** 2-3 days. Pays for itself on the next UI iteration.

### WhatsApp template rejections
- 4 Meta templates (monthly_summary, weekly_summary, missed_close, close_completed) were rejected for "Acceptable Use Breach" — Utility-category templates with marketing language.
- **Rewrites already drafted in chat history** (no code change — pure Meta dashboard edits).
- **Action:** edit each template body in Meta WhatsApp Manager, resubmit one at a time (start with `missed_close`).

### Quick UX polish that didn't make the audit Top-10
- Reports rendering PDFs **client-side** via pdf-lib (audit #2.10) — at 12+ months of history this OOMs the browser. Move to server-side + signed URL download.
- Hand-rolled `dynamicPhraseRules` regex for translation interpolation — flaky for languages with different word order (Arabic, Hindi). Solved properly by next-intl above.
- No global "fix mid-session" mechanism if a user's role/permissions change while they're signed in.
- Pagination missing on `/stores`, `/employees`, `/daily-close/history`.

---

## 🛠️ Operational state of staging

| | |
|---|---|
| Render API | `daily-close-api-staging.onrender.com` — current SHA: `360624d` |
| Vercel web (stable branch alias) | `daily-close-git-staging-alsoufi0s-projects.vercel.app` |
| Supabase project ref | `gvlycdpjaxewlwgspiqz` |
| Migration 005 (idempotency_key column) | ✅ applied to staging Supabase |
| Migration 006 (store assignments) | ✅ applied to staging Supabase — ran statement-by-statement (Prisma `$executeRawUnsafe` 42601 on the multi-statement file is expected). Verified: role col, composite unique, submitted_by_user_id, 4 OWNER backfill assignments. Fresh-account upload smoke test passed end-to-end. |
| Migration 007 (date → timestamptz) | ❌ NOT yet applied — fixes the false "already closed for this date" bug. Partner action below. Idempotent + safe to run as one statement (single `do $$ … $$` block, so no 42601 problem). |
| `ALLOW_DEMO_AUTH` env var on Render | ✅ removed |
| `NODE_ENV` on Render staging | `staging` (temporary — Sentry-required-in-prod gate is disabled until SENTRY_DSN is set) |
| `SENTRY_DSN` on Render staging | ❌ not set — see "Pending dashboard work" below |
| `OCR_SPACE_API_KEY` on Render staging | ❌ not set — using public "helloworld" demo key (~500/day, rate-limited) |
| Mobile EAS staging build | ❌ not built yet (intentional — testing on Vercel first) |

---

## 🔑 Pending dashboard work (partner)

0. **Apply migration 007** (`supabase/migrations/007_daily_close_date_timestamptz.sql`) to staging Supabase. Fixes the false "already closed for this date" rejection. It's a single `do $$ … $$` block, so it runs fine in one shot (no 42601). Idempotent — only alters if the column is still `date`.
1. **OCR_SPACE_API_KEY** — get free registered key at `https://ocr.space/ocrapi/freekey` (60 sec, no credit card). Add to Render staging env. Replaces public `helloworld` key (which throttles aggressively).
2. **SENTRY_DSN** — create `daily-close-staging` Sentry project (free tier), add DSN to Render staging env, then flip `NODE_ENV` from `staging` back to `production` so staging mirrors prod behavior.
3. **Supabase PITR** — enable Point-in-Time Recovery on staging Supabase project (~$10/mo). Required for any meaningful disaster-recovery story.
4. **(When ready for prod)** the same three on the production Render service, plus a separate prod Sentry project.

---

## 📝 Notes

- `main` branch is intentionally untouched — staging is the integration branch. Promote to main only after end-to-end smoke testing.
- Two GitHub PATs (`ghp_zrNRe2L…`, `ghp_f12Jk41…`, `ghp_cd9pGKK…`) were shared in chat during this work — they should all be revoked at GitHub Settings → Developer settings → PATs.
- The full pre-audit `docs/PRE_PUBLISHING_TASKS.md` (separate file) still tracks App Store / Play Store readiness items; that document is older and orthogonal to this audit backlog.
