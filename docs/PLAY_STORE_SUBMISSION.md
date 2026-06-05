# Google Play submission pack — Daily Close (Android)

Everything needed to publish the Android app. Your partner uploads the AAB and
fills these fields in **Play Console** (his business account). Copy/paste the
text below; gather the assets in the checklist.

- **Package name:** `com.dailyclose.app` (permanent — cannot change after first upload)
- **Version:** 1.0.0 (versionCode auto-increments per production build)
- **Build:** production **AAB** via `eas build -p android --profile production`
  (Play requires an App Bundle, not an APK)
- **Category:** Business
- **Pricing:** Free (subscription billed on the web — no in-app purchase)

---

## 1. Store listing (copy/paste)

**App name** (max 30 chars)
```
Daily Close
```

**Short description** (max 80 chars)
```
Fast nightly cash-up, sales close, and multi-store reports for shop owners.
```

**Full description** (max 4000 chars)
```
Daily Close is the fastest way for convenience stores and smoke shops to close out the day — and for owners to keep an eye on every location from one place.

Closing the register shouldn't take 30 minutes or a spreadsheet. Daily Close walks your employee through a simple, guided nightly close in a few taps:

• Snap a photo of the POS/sales receipt
• Enter cash sales, card sales, and totals
• Count the drawer and record the safe drop
• Log expenses (with a photo of each receipt for your records)
• Submit — the day is closed and the owner is notified

FOR OWNERS
• Live dashboard across all your stores
• See tonight's sales, cash over/short, and net profit as closes come in
• Catch a missed close or a register that's short — right away
• Export clean CSV and PDF reports for any date range
• Download every receipt, organized by store and date

FOR EMPLOYEES
• One simple step at a time — no training needed
• Works on any phone
• Pick the closing date up front so nothing gets filed on the wrong day

BUILT FOR REAL STORES
• Multi-store support with per-store managers
• Business-day aware (handles closing after midnight and across time zones)
• Optional SMS/WhatsApp alerts for missed closes and daily summaries
• Available in English, Spanish, Arabic, and Hindi

Start a free trial — no card required. Manage your subscription anytime at dailyclose.us.

Questions? dailyclose.us
```

> Subscriptions are sold and managed on the website (dailyclose.us), not in the
> app — so there is **no in-app purchase** to declare. Keep it that way for the
> Android build too (a neutral "Manage subscription on the web" link is fine on
> Play; Apple is the strict one).

---

## 2. Graphic assets (checklist — these must be created)

| Asset | Spec | Status |
|---|---|---|
| App icon | **512×512** PNG, 32-bit, no alpha rounding needed | Resize from `apps/mobile/assets/icon.png` (1024×1024) |
| Feature graphic | **1024×500** PNG/JPG (no transparency) | **Needs design** — banner with logo + tagline on the brand green (#0e3b34) |
| Phone screenshots | 2–8, PNG/JPG, 16:9 or 9:16, min 320px, max 3840px | **Capture from the Android build** |

**Screenshots to capture** (from the running app — the production/preview build):
1. Sign-in / Get Started
2. Owner dashboard (today's sales across stores)
3. Close flow — Upload step (store + closing date at top)
4. Close flow — Cash count or Expenses (with "Add receipt photo")
5. Reports — export + receipts with Closes/Expenses filter
6. Close success screen

(7" / 10" tablet screenshots are optional unless you want a tablet listing.)

---

## 3. Data safety form (Play Console → App content → Data safety)

The app collects this data. None is sold; processors (Supabase, Render, Stripe,
Twilio, Sentry) handle it on our behalf — under Play's rules that is **not**
"sharing." All transfer is **encrypted in transit (HTTPS)**, and users can
delete their account **in-app** (Settings/Account → Delete account).

| Data type | Collected? | Purpose | Required | Shared |
|---|---|---|---|---|
| Name | Yes | Account management, App functionality | Required | No |
| Email address | Yes | Account management | Required | No |
| Phone number | Yes (optional) | Account management, SMS/WhatsApp alerts | Optional | No |
| Photos (receipt images) | Yes | App functionality (the close record) | Optional | No |
| Other financial info (store sales/cash/expense figures the user enters) | Yes | App functionality | Required | No |
| Purchase history (subscription status) | Yes | App functionality, Account management | Required | No |
| Crash logs & diagnostics (Sentry) | Yes | Analytics, App functionality (stability) | Optional | No |
| App interactions | Yes | Analytics | Optional | No |

Answers to the gate questions:
- **Does your app collect or share user data?** Yes
- **Is all data encrypted in transit?** Yes
- **Do you provide a way to request data deletion?** Yes — in-app account deletion **and** a contact path in the privacy policy.

> Payment-card data for the subscription is entered on **Stripe's** checkout (web),
> not in the app — so the app itself does not collect "User payment info."

---

## 4. Content rating (App content → Content rating questionnaire)

- Category: **Utility / Productivity / Other** (business tool)
- Answer **No** to all violence / sexual / profanity / drugs / gambling
  questions (it's a store-management utility).
- Expected result: **Everyone / PEGI 3**.

---

## 5. App access (for the review team)

The app is behind a login, so Google's reviewers need a working account:
- Provide a **demo owner login** (email + password) with at least one store and
  a couple of sample closes, under **App access → All functionality → add
  credentials**.
- Confirm the **prod API** is deployed (`main`) and reachable, or review fails.

---

## 6. Privacy policy

- URL: **https://dailyclose.us/privacy**
- ⚠️ Before submitting, make sure it covers the data-safety categories above
  (name, email, phone, photos, financial figures, crash/diagnostics) and the
  **in-app deletion** path. (Tracked in `docs/PRE_PUBLISHING_TASKS.md` P1 #5.)

---

## 7. Partner's step-by-step in Play Console

1. **Create app** → name "Daily Close", default language English (US), App, Free.
2. **Set up → App access** → add the demo login (section 5).
3. **App content** → Privacy policy URL, Ads (No ads), Data safety (section 3),
   Content rating (section 4), Target audience (18+/Business), News (No).
4. **Store listing** → paste section 1; upload assets from section 2.
5. **Production → Create release** → upload the **AAB** (from EAS; download or
   wire `eas submit -p android` with a Play service-account JSON).
6. Roll out to **Internal testing** first (instant, test on real devices), then
   **Production** when it looks right.
7. Submit for review.

---

## Open blockers before submitting
- [ ] Privacy policy completeness for the Data safety label (P1 #5)
- [ ] POS-image **retention policy** + cleanup, documented in privacy (P1 #8)
- [ ] **Prod API deployed** (`main`) so the demo login + features work for reviewers
- [ ] Feature graphic designed; screenshots captured; 512 icon exported
