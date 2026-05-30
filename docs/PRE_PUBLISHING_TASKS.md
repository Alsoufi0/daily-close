# Pre-Publishing Tasks — Store Compliance Audit

Findings from the 2026-05-26 store-compliance scan. These are issues that could block App Store / Google Play approval or expose the app to privacy/regulatory risk. Track separately from the deployment checklist in `APP_STORE_READINESS.md` — that doc covers *how to ship*, this one covers *what would get rejected*.

Status legend: `[ ]` open · `[x]` done · `[~]` in progress

---

## P0 — Will likely cause rejection if not fixed

### [ ] 1. iOS in-app account deletion (Guideline 5.1.1(v))
Apple requires apps that let users sign in to also offer **in-app** account deletion, not just an email contact. `apps/web/app/privacy/page.tsx` currently routes deletion to `support@dailyclose.app`.

**Action:**
- Add "Delete my account" button on mobile (Owner/Employee profile area).
- Add `DELETE /auth/me` (or `/users/me`) endpoint in NestJS API that:
  - Calls `supabase.auth.admin.deleteUser(authUserId)` (already used in `apps/api/src/employees/employees.service.ts:180`).
  - Cascades store/employee/daily_close/notification rows belonging to the user.
- Update privacy policy to describe the in-app path.

### [ ] 2. Subscription billing model vs. Apple IAP (Guideline 3.1.1 / 3.1.3)
`apps/web/app/terms/page.tsx` advertises **$49.99 USD per store per month**. If the iOS app surfaces this paid functionality, Apple requires IAP (and takes 30%). Stripe checkout from inside an iOS app gets rejected unless the app qualifies for the B2B exemption.

**Decision needed (pick one):**
- B2B / Custom App path via Apple Business Manager (narrow, requires the buyer's org on roster).
- Strip pricing/purchase UI from iOS build; owners subscribe via web only (reader-app pattern, risky).
- Implement Apple IAP for iOS (cost: 30% rev share).
- Google Play has the same rule but enforces it less aggressively for B2B.

### [ ] 3. Demo bypass in production builds
- `apps/mobile/src/screens/LoginScreen.tsx:116-117` ships "Open Owner View (demo)" and "Open Employee View (demo)" buttons that bypass auth.
- `.env.example` documents an `ALLOW_DEMO_AUTH` flag that lets `x-demo-role` headers bypass real auth.

**Action:**
- Gate mobile demo buttons behind `__DEV__` or `EXPO_PUBLIC_DEMO_MODE`, off in production.
- Verify production env has `ALLOW_DEMO_AUTH=false`; consider deleting the demo-auth code path entirely before launch.

### [ ] 4. EAS / submission placeholders unfilled
- `apps/mobile/app.json:38` — `"projectId": "replace-after-eas-init"`.
- `apps/mobile/eas.json:25-27` — `REPLACE_WITH_APPLE_ID`, `REPLACE_WITH_APP_STORE_CONNECT_APP_ID`, `REPLACE_WITH_TEAM_ID`.

Already tracked in `APP_STORE_READINESS.md` Phase 5/7, listed here for completeness.

---

## P1 — Privacy / Store Listing risks

### [ ] 5. Privacy policy too thin for App Store Privacy Nutrition Label
`apps/web/app/privacy/page.tsx` needs explicit coverage for Apple's questionnaire categories:
- **Contact Info** (email) — linked to identity.
- **User Content** (POS images, notes, daily close numbers) — linked to identity.
- **Identifiers** (user ID) — linked to identity.
- **Diagnostics** — Sentry (currently on web/API; if added to mobile, disclose).
- Explicit **data retention period** (current "for the lifetime of the daily close record" is indefinite — CCPA/GDPR want a window).
- **WhatsApp Business** is configured (`.env.example`) but never disclosed as a data recipient.

### [ ] 6. Bundle identifier domain ownership
`apps/mobile/app.json:17,27` uses `com.dailyclose.app`. Apple may ask for DNS proof of ownership of `dailyclose.app`. Register the domain or switch to a reverse-domain you control.

### [ ] 7. Accessibility labels missing on icon-only buttons
- `apps/mobile/src/screens/EmployeeScreen.tsx:200,208` — emoji-only 📷 / 📁 buttons need `accessibilityLabel`.
- `apps/mobile/src/screens/LoginScreen.tsx:103` — feature icon row.
Google's pre-launch report will flag these; Apple sometimes does.

### [ ] 8. POS image retention policy
`apps/mobile/src/upload-pos-report.ts:34` uses 24h signed URLs but Supabase Storage files are never purged. Pick a retention window (e.g. 90 days post-close), add a cleanup cron, document it in the privacy policy.

---

## P2 — Polish before submission

### [ ] 9. Replace script-generated app icon
`apps/mobile/assets/generate.py` produces the current icon. Apple occasionally rejects generic auto-generated icons. Commission a designed icon before submission.

### [ ] 10. Sign in with Apple — not required today
Email/password only auth means no Sign in with Apple obligation. **If** Google/Facebook sign-in is added later, Apple requires Sign in with Apple as an option on iOS.

### [ ] 11. Mobile localization declaration
`shared/i18n/index.ts` ships Spanish, but `apps/mobile/app.json` doesn't declare `locales`. Add the supported locales to improve App Store discoverability in Spanish-speaking markets.

### [ ] 12. Splash safe area verification
`apps/mobile/assets/splash.png` is 1284×2778 (iPhone 6.7"). With `resizeMode: contain`, smaller devices letterbox on `#1f7a4d`. Brand-color match makes this acceptable but verify on iPhone SE simulator.

---

## P0/P1 — Localization gaps (audit 2026-05-26)

The app uses two translation mechanisms in parallel: explicit `t("key")` calls (reliable, works everywhere) and a DOM-watching auto-translator backed by a `phraseKeys` map in `apps/web/components/language-provider.tsx` (web only, fragile, matches exact strings). Plan: finish migrating to explicit `t()` everywhere; treat auto-translate as a fading safety net.

### [ ] L1. Mobile app is effectively English-only — **launch blocker for non-EN markets**
- `apps/mobile/src/i18n.ts` defines `t()` and `setMobileLanguage()`, but `setMobileLanguage()` is **never called anywhere**.
- No language switcher UI in mobile, no `AsyncStorage` read on startup → mobile stays in the default English regardless of user choice on web.
- Only `apps/mobile/src/screens/OwnerScreen.tsx` imports `t`. `LoginScreen.tsx` and `EmployeeScreen.tsx` don't import it at all.

**Action:**
1. Add a mobile language picker (Settings screen or header dropdown).
2. Persist the choice in `AsyncStorage`, read on app boot, call `setMobileLanguage()`.
3. Then wrap mobile strings (see L2).

### [ ] L2. Mobile screens — ~31 hardcoded strings to wrap in `t()`
- `apps/mobile/src/screens/LoginScreen.tsx` (~9): FEATURES array L8-12, "Welcome back.", pill labels "SIGN IN"/"MOBILE PILOT", auth errors, "Signing in…", legal disclaimer L120.
- `apps/mobile/src/screens/EmployeeScreen.tsx` (~17): step titles (L33-39), button props (L188, 239, 243, 250, 286), banner copy L212, `Alert.alert()` permission/error prompts (L86, 93, 113, 149), JSX text L179/186/187/285, fallback "My Store" L75, header subtitle fallback L165.
- `apps/mobile/src/screens/OwnerScreen.tsx` (3): "Today's Store Close" L42, "Welcome back" L47, "Cash counted is lower than expected." L80.
- `apps/mobile/src/upload-pos-report.ts` (2): error strings L16, L35.

### [ ] L3. Web pages — ~30 hardcoded strings
- `apps/web/app/admin/employees/page.tsx` (11): error fallbacks L42/75/96/98/122, "Admin access turned on/off." L96, "Sending…" L204, "Make Admin"/"Remove admin access" L256/253, "Full name" L158, aria-labels "Reset password"/"Remove employee" L262/271.
- `apps/web/app/billing/page.tsx` (5): feature card bodies L147-149, "Could not start checkout." L43, "Starting…" L129, plan label "Standard" L12.
- `apps/web/app/signup/page.tsx` (5): error strings L26/32/46/80, "Creating account…" L179.
- `apps/web/app/setup/page.tsx` (5): "You need to sign in first." L39, "Could not create store"/"Could not invite employee" L54/73, "Creating…"/"Sending…" L150/194.
- `apps/web/app/account/password/page.tsx` (4): error strings L31/36/43, "Updating…" L122.
- `apps/web/app/forgot-password/page.tsx` (2): "Supabase is not configured…" L19, "Sending…" L81.
- `apps/web/components/edit-close-modal.tsx` (3): "Could not save" L53, placeholder "e.g. Cash bag from prior day" L106, "Counted Cash" L97, "Saving…" L123.
- `apps/web/components/history-panel.tsx` (2): aria-labels "Edit close" L135, "Delete close" L143.
- `apps/web/components/top-bar.tsx` (1): aria-label "Close menu" L120.
- `apps/web/app/layout.tsx` (1): metadata title L16 (server-rendered, won't be caught by the DOM observer — may need to stay English or use Next.js metadata localization).

### [ ] L4. Quick wins — augment `phraseKeys` map
For aria-labels and short labels that we don't want to migrate to `t()` yet, add the English source string + key to the `phraseKeys` map in `apps/web/components/language-provider.tsx` and the four translations to `shared/i18n/index.ts`. Covers history-panel, top-bar, and admin aria-labels without code edits at the call sites.

### Order of attack
1. **L1 first** — without the mobile language switcher, fixing mobile screens is wasted work.
2. **L2** — mobile is the worst-off; pilot users on non-English markets see all English.
3. **L3** — web admin/billing/signup error messages.
4. **L4** — phraseKeys quick wins for aria-labels.
