# Google Play listing — Daily Close (Android)

Paste-ready listing text and the Play-specific compliance answers. The graphic
assets are in `docs/store-assets/play/` (icon, feature graphic, five
screenshots). Re-render the screenshots with
`docs/store-assets/play/screenshots/render.sh`.

- **Package:** `com.dailyclose.app`
- **Category:** Business
- **Pricing:** Free (subscription billed on the web)
- **Privacy policy:** https://dailyclose.us/privacy
- **Default language:** English (United States)

---

## App title (max 30)
```
Daily Close
```

## Short description (max 80)
```
Close your store in two minutes and see every location's cash at a glance.
```

## Full description (max 4000)
```
Daily Close is the fastest way for convenience stores and smoke shops to close out the day, and for owners to keep an eye on every location from one screen.

Closing the register should not take half an hour or a spreadsheet. Daily Close walks your staff through a simple, guided close in a few taps.

THE NIGHTLY CLOSE, IN TWO MINUTES
Pick the date, photograph the POS report, enter cash and card sales, count the drawer, log expenses, and submit. One step at a time, with the cash over or short worked out for you. No training needed.

FOR OWNERS
See tonight's sales, expected cash, and any shortage across every store as the closes come in. Catch a missed close or a register that is short right away. Open any close to see sales, expenses, refunds, and net profit laid out plainly.

EXPORT FOR YOUR BOOKS
Pull clean CSV and PDF reports for any date range, one store or all of them. Download every receipt, organized by store and date, with closes and expenses kept separate.

EXPENSES WITH A PAPER TRAIL
Log each expense and snap a photo of the receipt, so you always have the record.

BUILT FOR REAL SHOPS
Multi-store support with per-store managers. Business-day aware, so a close after midnight still lands on the right day. Optional SMS and WhatsApp alerts for missed closes and daily summaries. Works offline and syncs when you are back online. Available in English, Spanish, Arabic, and Hindi, with full right-to-left support.

Start a free trial, no card required. Manage your subscription any time at dailyclose.us.

Questions? Visit dailyclose.us.
```

## Tags / keywords (for ASO; Play has no keyword field, use these in the copy and store settings)
retail, point of sale, cash register, store management, daily closing, end of day, cash reconciliation, sales report, small business, convenience store, smoke shop

---

## Graphic assets (in `docs/store-assets/play/`)
| Asset | Spec | File |
|---|---|---|
| App icon | 512×512, 32-bit PNG | `icon-512.png` |
| Feature graphic | 1024×500 PNG | `feature-graphic.png` |
| Screenshot 1 — dashboard | 1080×2400 | `screenshots/01-dashboard.png` |
| Screenshot 2 — 2-minute close | 1080×2400 | `screenshots/02-close.png` |
| Screenshot 3 — reports | 1080×2400 | `screenshots/03-reports.png` |
| Screenshot 4 — export | 1080×2400 | `screenshots/04-export.png` |
| Screenshot 5 — built for shops | 1080×2400 | `screenshots/05-features.png` |

Tablet screenshots: skipped (app is phone-first; do not mark tablet-supported).

---

## Data safety form (Play Console → App content → Data safety)

We collect this data; it is used only for app functionality and account
management, **linked to the user's account**, and **not used for tracking or
advertising**. None is sold. Processors (Supabase, Render, Stripe, Twilio,
Sentry) handle it on our behalf, which Play does not count as "sharing." All
transfer is **encrypted in transit**, and users can **delete their account
in-app** (Settings/Account → Delete account).

Gate questions:
- Does your app collect or share user data? **Yes**
- Is all data encrypted in transit? **Yes**
- Do you provide a way to request data deletion? **Yes (in-app + privacy policy)**

| Data type | Collected | Purpose | Linked to user | Used for tracking |
|---|---|---|---|---|
| Name | Yes | App functionality, Account management | Yes | No |
| Email address | Yes | Account management | Yes | No |
| Phone number | Yes (optional) | Account management, SMS/WhatsApp alerts | Yes | No |
| Photos (POS / expense receipts) | Yes | App functionality | Yes | No |
| Other financial info (store sales / cash / expense figures) | Yes | App functionality | Yes | No |
| Purchase history (subscription status) | Yes | App functionality, Account management | Yes | No |
| Crash logs & diagnostics | Yes | App functionality (stability) | Yes | No |
| App interactions | Yes | Analytics | Yes | No |

> Card/payment data for the subscription is entered on Stripe's checkout (web),
> not in the app, so the app does not collect "User payment info."

---

## Content rating (App content → Content rating questionnaire)
- Category: **Utility / Productivity / Other** (a business tool).
- Answer **No** to every violence / sexual content / profanity / drugs /
  gambling / user-generated-content-sharing question.
- Expected result: **Everyone** (IARC), PEGI 3.

---

## Billing note (Android vs iOS)
Unlike iOS (where the in-app purchase CTA is stripped for Guideline 3.1.1),
**Android keeps a neutral "Manage subscription" link to the web**. Play is
lenient on external billing for B2B tools, so the Android build can show it.

---

## App access (for Google's reviewers)
The app is behind a login. Under **App access → All functionality**, add a
**demo owner account** (email + password) with at least one store and a few
sample closes. Make sure the production API is deployed and reachable, or review
will fail.
