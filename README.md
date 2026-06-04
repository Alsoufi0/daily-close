# Daily Close

Daily closing for retail, done in ~2 minutes. Employees close each store from any
phone (scan the POS report, count cash, submit); owners see today's sales, missing
cash, and missed closes across every location — and export clean numbers for their
accountant.

**Live:** https://dailyclose.us

## Features

- **Marketing site** — landing, how-it-works, tutorials (phone-frame demo videos),
  pricing, contact. English/Arabic/Spanish/Hindi (Arabic RTL). Sign-in links into
  the app at `/login`.
- **Daily close in steps** — upload the POS report (OCR auto-fills the numbers via
  Google Vision), review sales, count cash (over/short computed), add expenses,
  finish. Works offline with a sync outbox on mobile.
- **Owner dashboard** — today's sales, which stores closed, missing cash, and
  missed-close alerts across all stores; history with CSV + PDF export.
- **Per-store billing (Stripe)** — $49.99 per store / month, 14-day free trial.
  Subscription quantity tracks active store count (prorated). Self-serve billing
  portal (update card / cancel). When an owner is unpaid the whole store is locked
  (owner and employees) with no data loss; access resumes on renewal.
- **Auth** — Supabase email/password and phone (WhatsApp/SMS one-time code) sign-in.
  Per-store manager role (store-scoped admin) in addition to owner and employee.
- **Notifications** — Twilio SMS / WhatsApp (missed-close + weekly/monthly summaries)
  and Resend email (employee welcome, password reset, summaries).
- **Mobile** — native iOS/Android app (Expo / React Navigation), same API and data
  as the web. Ships via EAS.

## Architecture

Monorepo (npm workspaces):

| Path | What | Hosting |
| --- | --- | --- |
| `apps/web` | Next.js (App Router) — marketing site + app UI | Vercel → dailyclose.us |
| `apps/api` | NestJS REST API (`@smokeshop/api`) | Render → smokeshop-api.onrender.com |
| `apps/mobile` | Expo / React Native app | EAS build (not via `main`) |
| `shared` | Shared types, i18n (4 locales), utils | — |
| `database` | Prisma schema + SQL migrations | Supabase Postgres |
| `supabase` | RLS policies, seed, storage setup | Supabase |

Data lives in Supabase (Postgres + Storage). The web app authenticates with Supabase
directly, then calls the API with the JWT. Stripe handles billing; Twilio handles
SMS/WhatsApp; Resend handles transactional email; Google Vision powers POS OCR.

## Local development

Prerequisites: Node 18+ and npm. Copy the example env and fill in your own keys:

```bash
cp apps/api/.env.example apps/api/.env   # API: Supabase, Stripe, Twilio, Resend, Google Vision
# Web reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_API_URL
```

```bash
npm install                # install all workspaces
npm run prisma:generate    # generate the Prisma client

npm run dev:web            # web on http://127.0.0.1:3000
npm run dev:api            # API on http://127.0.0.1:4000 (Swagger at /docs)
npm run dev:mobile         # Expo dev server
```

## Quality

```bash
npm run typecheck                  # web + api + mobile
npm test --workspace apps/api      # API unit tests (Jest)
npm run build                      # production build (web + api)
```

## Deployment

- **Web** auto-deploys to Vercel from `main` (each branch gets a preview URL).
- **API** auto-deploys to Render (`smokeshop-api`) from `main` (`render.yaml`).
- **Mobile** ships via EAS from a mobile branch (not through `main`).

> Production pushes go through pull requests — direct pushes to `main` are blocked.
> Open a PR and merge it (`gh pr merge`).

Secrets are configured in the Vercel / Render / Supabase dashboards; never commit
real keys. See `apps/api/.env.example` for the full list of required variables.
