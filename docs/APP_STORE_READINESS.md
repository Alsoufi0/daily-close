# App Store Readiness — Launch Checklist

Concrete steps from where we are today to **paid, production pilot live in both stores**. Each step has an owner (✋ = you, 🤖 = already done in repo) and an estimate.

---

## Phase 0 — What's already done 🤖

- [x] Web app deployed to Vercel and aliased to `https://daily-close.vercel.app`
- [x] NestJS API hardened (CORS scoped, security headers, Swagger gated, `/health` + `/health/ready`, graceful shutdown, cross-owner authz fix)
- [x] 22 backend tests passing
- [x] Mobile app rebuilt with brand header, step progress, KeyboardAvoidingView, permission prompts
- [x] `apps/api/Dockerfile` + `render.yaml` for one-click API deploy
- [x] `apps/mobile/app.json` + `eas.json` with build/submit profiles
- [x] `.env.example` documents every required env var

---

## Phase 1 — Production data layer (≈ 1 hour) ✋

- [ ] Create Supabase project at https://supabase.com/dashboard (region: closest to pilot stores).
- [ ] In SQL editor, run `supabase/migrations/001_production_schema.sql`.
- [ ] In SQL editor, run `supabase/seed.sql`.
- [ ] Auth → Users → invite (or create with password):
  - `owner@demo.com`
  - `maya@demo.com`
  - `chris@demo.com`
- [ ] Copy each auth user's UUID → `public.users.auth_user_id`.
- [ ] Storage → create bucket `pos-reports` (private).
- [ ] Copy from Settings → API: `SUPABASE_URL`, `anon` key, `service_role` key.

---

## Phase 2 — API host (≈ 30 min) ✋

- [ ] Push this repo to GitHub (one-time; the cloud Claude session can do this, or run `git init` + `gh repo create` locally).
- [ ] Render → New → Blueprint → point at the repo. `render.yaml` provisions the service automatically.
- [ ] In Render dashboard → Environment, set the `sync: false` secrets:
  - `DATABASE_URL` (from Supabase → Settings → Database → Connection string, "session" pooler)
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Deploy and confirm `https://<service>.onrender.com/health` returns `{"status":"ok"}`.
- [ ] Confirm `/health/ready` returns 200 (Prisma can reach the DB).

---

## Phase 3 — Wire web ↔ API (≈ 10 min) ✋

- [ ] In Vercel → Project → Settings → Environment Variables (Production), add:
  - `NEXT_PUBLIC_API_URL` = `https://<service>.onrender.com`
  - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key
- [ ] Redeploy: `npx vercel --prod --yes`.
- [ ] Sign in at the live URL with `owner@demo.com` → owner dashboard should show **Production data** badge.

---

## Phase 4 — Mobile app assets (≈ 2 hours, design) ✋

- [ ] Replace placeholders per `apps/mobile/assets/README.md`:
  - `icon.png` 1024×1024
  - `adaptive-icon.png` 1024×1024 (transparent bg)
  - `splash.png` 1284×2778
- [ ] Capture 3–5 store screenshots at 1290×2796 (login, owner dashboard, store card, employee close steps, success).

---

## Phase 5 — EAS init + builds (≈ 1 hour first time) ✋

- [ ] Apple Developer Program account ($99/yr) and Google Play Console ($25 one-time).
- [ ] `cd apps/mobile && npx eas login` then `npx eas init`. Copy the returned project ID into `app.json` → `extra.eas.projectId`.
- [ ] Set EAS secrets:
  ```bash
  npx eas secret:create --name EXPO_PUBLIC_API_URL --value https://<service>.onrender.com
  npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co
  npx eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key>
  ```
- [ ] Internal builds:
  ```bash
  npx eas build --platform ios --profile preview
  npx eas build --platform android --profile preview
  ```
- [ ] Install on a real phone, run a full close end-to-end. Verify camera + photo library permission prompts.

---

## Phase 6 — Pilot QA (≈ 2 hours) ✋

Per `docs/production-runbook.md` § 6:
- [ ] Owner A cannot see Owner B's stores (try editing the URL).
- [ ] Employee cannot open `/owner` (route should redirect or 403).
- [ ] Employee cannot submit a close for a store they don't own.
- [ ] Employee can complete a close in **< 2 minutes** on a real phone.
- [ ] Store with no close shows yellow missed-close alert.
- [ ] Store with negative cash difference shows red missing-cash alert.
- [ ] CSV export downloads today's store comparison.
- [ ] `/health` and `/health/ready` both return 200 from production.

---

## Phase 7 — Store submission (≈ 1 hour active + 1–3 days review) ✋

- [ ] In `apps/mobile/eas.json` → `submit.production.ios`, fill `appleId`, `ascAppId`, `appleTeamId`.
- [ ] Google: create a service account in Play Console → download JSON → save as `apps/mobile/google-play-service-account.json` (gitignored).
- [ ] Production builds + submission:
  ```bash
  npx eas build --platform ios --profile production
  npx eas build --platform android --profile production
  npx eas submit --platform ios
  npx eas submit --platform android
  ```
- [ ] App Store Connect listing: app name, subtitle (max 30 chars), description, keywords, support URL, marketing URL, screenshots, privacy policy URL → `https://daily-close.vercel.app/privacy`.
- [ ] Play Console listing: short description (80), full description (4000), feature graphic 1024×500, app icon 512×512, screenshots, privacy URL.

---

## Phase 8 — Day-one operations ✋

- [ ] Custom domain (optional but recommended): point `app.dailyclose.example.com` → Vercel, `api.dailyclose.example.com` → Render. Update `ALLOWED_ORIGINS` on Render to include the new domain.
- [ ] Set up a daily 11pm cron in Render or a Supabase scheduled function that hits `POST /notifications/check-missed-close` (use a service-account token or a shared HMAC).
- [ ] Subscribe at least one human to Render alerts and Supabase logs.
- [ ] Document the support email used in Privacy/Terms (update `apps/web/app/privacy/page.tsx` and `apps/web/app/terms/page.tsx`).

---

## Costs to expect (year 1)

| Item | Cost |
|---|---|
| Vercel Hobby (web) | Free |
| Render Starter (API) | $7/mo |
| Supabase Free tier (≤500 MB DB, 1GB storage) | Free, upgrade to Pro $25/mo when needed |
| Apple Developer Program | $99/yr |
| Google Play Console | $25 one-time |
| Custom domain (optional) | ~$15/yr |
| **Total year 1, no domain** | **~$208** |

---

## Out of scope for v1 (do not block launch)

- Real OCR (currently mocked — uploaded images are stored, parsing returns sample data)
- Push notifications (in-app + email only at pilot)
- Multi-language
- iPad layout (`supportsTablet: false`)
- Direct POS API integration
