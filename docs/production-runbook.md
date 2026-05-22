# SmokeShop Daily Close — Production Runbook

For the full launch sequence with time estimates and costs, see [`APP_STORE_READINESS.md`](./APP_STORE_READINESS.md). This file is the operator reference.

## 1. Supabase

1. Create Supabase project. In SQL editor, run in order:
   - `supabase/migrations/001_production_schema.sql`
   - `supabase/migrations/002_subscriptions.sql` (subscription columns + 14-day trial)
   - `supabase/seed.sql`
2. Auth → create users `owner@demo.com`, `maya@demo.com`, `chris@demo.com`.
3. Copy each Auth user UUID into `public.users.auth_user_id`.
4. Storage → create private bucket `pos-reports`.

## 2. API (NestJS) — Render

Deploy from `apps/api/Dockerfile` via `render.yaml` (Blueprint). Required env vars:

```bash
NODE_ENV=production
PORT=4000
ENABLE_SWAGGER=false          # set true only when you need to expose /docs
ALLOW_DEMO_AUTH=false         # NEVER true in production
ALLOWED_ORIGINS=https://follow-th-pbelow-exaclty-smokeshop.vercel.app
DATABASE_URL=postgresql://...        # Supabase session pooler
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_REPORTS_BUCKET=pos-reports
```

Health probes:

- `GET /health` — liveness (always 200 if process is up)
- `GET /health/ready` — readiness (200 with `db: up`, 503 if Prisma can't reach DB)

Security: HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` disabling camera/geo/mic — all applied automatically by `src/main.ts`.

## 3. Web — Vercel

Project already linked: `prj_Gdf60aDL1xZzNi1bFjkGq3zFHKXP`. Required env vars (Production):

```bash
NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Redeploy: `npx vercel --prod --yes` from the project root.

## 4. Mobile (Expo / EAS)

```bash
cd apps/mobile
npx eas init                  # writes projectId into app.json
npx eas secret:create --name EXPO_PUBLIC_API_URL --value https://<render-service>.onrender.com
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key>

npx eas build --platform ios --profile preview
npx eas build --platform android --profile preview
# QA on real devices, then:
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
npx eas submit --platform ios
npx eas submit --platform android
```

Required assets in `apps/mobile/assets/` (see `apps/mobile/assets/README.md`):

- `icon.png` 1024×1024
- `adaptive-icon.png` 1024×1024 (transparent bg, brand inside center 66%)
- `splash.png` 1284×2778 on `#1f7a4d`

## 5. Missed-close cron

`POST /notifications/check-missed-close` creates yellow alert records. Already wired in `render.yaml` as the `smokeshop-missed-close-cron` service (daily 23:45 UTC). Set in the Render dashboard:

- `CRON_API_URL` = `https://<service>.onrender.com`
- `CRON_TOKEN` = a long-lived bearer for a service-account user (create it once in Supabase Auth and store it).

Alternative: Supabase scheduled function via `pg_cron`.

## 6. Subscriptions / Stripe

The app ships with a `subscriptionStatus` and `trialEndsAt` on every owner (default: 14-day TRIALING). Write endpoints (`POST /stores`, `POST /employees/invite`) are gated by `SubscriptionGuard`, which returns HTTP 402 when an owner's trial expires and they have no active plan.

To enable real billing:
1. Create a Stripe product + price ($29/store/month suggested).
2. In Stripe Dashboard → Customer Portal, enable cancel/update payment.
3. Set in Render:
   - `STRIPE_CHECKOUT_URL` → the Stripe-hosted checkout link for the price.
   - `STRIPE_PORTAL_URL` → the Stripe customer portal link.
   - `STRIPE_WEBHOOK_SECRET` → from a webhook endpoint pointing at `POST /subscriptions/webhook`.
4. The webhook handler maps `customer.subscription.{created,updated,deleted}` → `owner.subscriptionStatus`.
5. When Stripe creates a customer for an owner, store the `stripe_customer_id` on the owner row (Stripe metadata can carry your owner id).

## 7. Pilot QA Acceptance

- Owner cannot see another owner's stores (URL-tamper test).
- Employee cannot open `/owner`.
- Employee cannot submit for another store.
- Employee can close in under 2 minutes on iPhone and Android.
- Missed close shows yellow alert.
- Negative cash difference shows red alert.
- CSV export downloads today's store comparison.
- `/health` and `/health/ready` both return 200.

## 8. Rollback

- Vercel: dashboard → Deployments → previous → Promote.
- Render: dashboard → Manual Deploy → previous commit.
- Mobile: EAS Update channel rollback (`npx eas update --channel production --branch <previous>`) for JS-only fixes; for native changes, submit a new build.

## 9. Day-2 watchlist

- Render service logs (filter `ERROR`).
- Supabase → Auth → users active in last 24h.
- Supabase → Reports → DB size approaching 500 MB free-tier cap.
- Vercel → Analytics → Web Vitals on `/owner` (LCP < 2.5s target).
