# Tiered pricing — go-live runbook

The app now shows and computes **graduated per-store pricing** (Solo/Multi/Growth/Chain).
The code is ready; flipping what customers are actually **charged** is a controlled Stripe
change. Do these steps together so the displayed price and the charged price never diverge.

## The model (single source of truth)

Defined in [`shared/pricing.ts`](../shared/pricing.ts) — graduated tiers:

| Stores | Rate per store |
|--------|----------------|
| 1 | $29 (2900¢) |
| 2–5 | $24 (2400¢) |
| 6–15 | $19 (1900¢) |
| 16+ | $14 (1400¢) |

Examples: 1=$29 · 4=$101 · 5=$125 · 6=$144 · 10=$220 · 16=$329. The Stripe Price below
**must mirror these exact numbers** — if you ever change one, change both in lockstep.

## What the code already does

- `/pricing` renders the interactive slider from `shared/pricing.ts`.
- The billing page computes the owner's monthly total + effective per-store from the same module.
- Checkout already sends `quantity = billable store count`. With a **graduated** Stripe price,
  Stripe computes the tiered total automatically — **no checkout code change needed**.
- `STRIPE_UNIT_AMOUNT_CENTS` (flat 4999) is now vestigial — the billing display no longer uses it.

## Step 1 — Create the graduated Stripe Price (LIVE mode)

Against the existing Daily Close product (`$STRIPE_PRODUCT_ID`):

```bash
stripe prices create \
  --currency usd \
  -d "product=$STRIPE_PRODUCT_ID" \
  -d "recurring[interval]=month" \
  -d "recurring[usage_type]=licensed" \
  -d "billing_scheme=tiered" \
  -d "tiers_mode=graduated" \
  -d "tiers[0][up_to]=1"   -d "tiers[0][unit_amount]=2900" \
  -d "tiers[1][up_to]=5"   -d "tiers[1][unit_amount]=2400" \
  -d "tiers[2][up_to]=15"  -d "tiers[2][unit_amount]=1900" \
  -d "tiers[3][up_to]=inf" -d "tiers[3][unit_amount]=1400" \
  -d "nickname=Per-store graduated (2026-06)"
```

Note the returned `price_...` id. (Stripe `graduated` tiers price each unit at its own tier's
rate — exactly our model. Verify with a quick test: a quantity-4 subscription should preview $101.)

## Step 2 — Point the app at it + deploy together

- Set `STRIPE_PRICE_ID=<new price id>` on the API service (Render) — replacing the old flat price.
- Deploy the web + API code (this PR) at the same time.

Because checkout passes `quantity`, new checkouts immediately bill on the graduated tiers. Displayed
price (`shared/pricing.ts`) now matches the charged price (the Stripe tiers).

## Step 3 — Move existing customers over (decision: migrate everyone)

For each **active** subscription, swap its item to the new price (keep the quantity). Most owners
pay the **same or less**, so this is welcome — but email them first as a courtesy.

```bash
# For each active subscription (si_... = its subscription item):
stripe subscriptions update <sub_id> \
  -d "items[0][id]=<si_id>" \
  -d "items[0][price]=<new_price_id>" \
  -d "proration_behavior=none"     # apply cleanly at the next cycle, no mid-cycle proration
```

- `proration_behavior=none` → the new tiered price takes effect on their next invoice (simplest,
  no surprise mid-cycle charges/credits).
- A small script over `stripe subscriptions list --status active` can do this in one pass; keep a
  log of `sub_id → old_price → new_price` for the record.

## Step 4 — Verify

- A test checkout at quantity 4 → first invoice $101.
- An existing migrated owner's upcoming invoice reflects the tiered total.
- Billing page + `/pricing` show matching numbers for the same store count.

## Rollback

Point `STRIPE_PRICE_ID` back at the old flat price and re-run Step 3 with the old price id. The
code (graduated math in `shared/pricing.ts`) would then over-state vs the flat charge, so revert
the code deploy too if rolling back fully.

---

## Localization note

The `$49.99 → from $29` copy was updated across all locales in `shared/i18n/index.ts`, so the
**number is correct everywhere**. The connector word ("from") is still English inside the
Spanish/Arabic/Hindi strings (e.g. "Pagas from $29…") — a minor cosmetic gap to clean up with the
broader i18n pass (see localization backlog), not a wrong price.
