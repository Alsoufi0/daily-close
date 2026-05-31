# Daily Close — Punch-list Report & Plan (2026-05-31)

Source: `Downloads/Claude Daily close.txt` (7 items + a mandate to stress-test the
whole app afterward). This report maps each item to the **actual code on branch
`staging` @ `ab0ce08`** (= current prod), states what is real vs. already-fixed,
and proposes a fix + verification plan.

Headline: **most of the 7 items were already implemented in code** (delete,
multi-store, optimistic refresh, a real reset page). The list predates the
current build. The genuinely-open work is: (a) a Supabase **config** fix for the
localhost reset link, (b) **pagination/show-more** on long lists, and (c) a real
**per-store admin** role (the schema already has `MANAGER`, it's just unused).

---

## Item-by-item findings

### 1. "Admin can't delete employees" — ALREADY IMPLEMENTED ✅ (verify on prod)
- API: `DELETE /employees/:id` → `EmployeesService.remove()` soft-deletes the
  assignment row and deletes the Supabase auth user (blocks sign-in).
  `apps/api/src/employees/employees.controller.ts:42`, `employees.service.ts:343`.
- Web: `admin/employees/page.tsx` has both a per-store chip "×" (`unassignFromStore`)
  and the full removal path (`remove`, line 86) with a confirm dialog.
- **Action:** confirm prod behaves; if the user still can't delete, it's a deploy-lag
  or a specific error (e.g. last-assignment edge). Add to E2E.

### 2. "Employee confirmation/welcome email not sent on add" — IMPLEMENTED ✅ (recheck delivery)
- API: `invite()` calls `EmailService.sendEmployeeWelcome()` for email invites
  (`employees.service.ts:179`). Memory records prod verified `emailSent:true` via Resend.
- Risk: only the **email** branch sends an email; **phone** invites send SMS (gated on
  Twilio toll-free approval, still external/pending). If the complaint was about a phone
  invite, that's the toll-free blocker, not a bug.
- **Action:** re-trigger a real email invite on prod, confirm Resend "sent" log + inbox.

### 3. "Adding an employee needs a manual page refresh" — IMPLEMENTED ✅ (one real bug)
- Web optimistically pushes the new row on invite (`page.tsx:241`). No refresh needed.
- **Real defect:** the pushed row is `{ id: result.id, user:{name,email}, storeId }` with
  **no `store` object**, so the grouping (`e.store?.storeName ?? ""`) renders an **empty
  store chip** until a real reload. Minor, but visible.
- **Action:** include `store: { id: storeId, storeName }` in the optimistic row (look up
  name from `session.stores`), matching what `confirmAssign` already does correctly.

### 4. "Reset-password link still opens a localhost page" — CONFIG bug, NOT app code ⚠️
- The page exists: `app/account/password/page.tsx`, and `forgot-password` sends
  `redirectTo = ${window.location.origin}/account/password` (`forgot-password/page.tsx:45`).
  In prod that origin is `https://dailyclose.us`, so app code is correct.
- The localhost link comes from **Supabase Auth config** on project `gvlycd`:
  - **Site URL** is still `http://localhost:3000` (Supabase falls back to it for the
    email-template `{{ .SiteURL }}` / `{{ .ConfirmationURL }}`), and/or
  - `https://dailyclose.us/account/password` is **not in the Redirect Allow List**, so
    Supabase ignores our `redirectTo` and uses Site URL.
- **Action (Management API PATCH, no code):** set `SITE_URL=https://dailyclose.us`,
  add `https://dailyclose.us/**` (and `/account/password`) to
  `URI_ALLOW_LIST`, on project `gvlycdpjaxewlwgspiqz`. Needs a Supabase `sbp_` token.
  Confirm the branded recovery template link resolves to dailyclose.us.

### 5. "No show-more / pagination on long lists" — GENUINELY OPEN ❌
Confirmed every long list renders the full array with `.map` (no cap, no show-more):
- Receipts: `app/owner/receipts/page.tsx:167` (`rows.map`)
- Stores: `app/stores/page.tsx:207` (`filtered.map`)
- Homepage history: `components/history-panel.tsx:128,167` (`rows.map`)
- Employees admin: `admin/employees/page.tsx:416` (`grouped.map`)
- (Dashboard store cards already cap at `slice(0,3)` w/ a "view all" — good pattern to copy.)
- **Action:** add a reusable client-side "show more" (initial N≈10, +N per click) to all four.
  Keep it client-only first (lists are already fully fetched); add server pagination later
  only if a store accumulates hundreds of receipts. Mobile is the priority per the note.

### 6. "Assign one employee to multiple stores" — ALREADY IMPLEMENTED ✅
- API: `POST /employees/:id/assignments` → `assignToStore()` (idempotent),
  `GET /employees/by-user/:userId/assignments`. Schema: `employees` is per-(user,store)
  with `@@unique([userId, storeId])` (migration 006).
- Web: `AssignToStoreModal` + per-store chips with unassign (`admin/employees/page.tsx`).
- **Action:** verify on prod; add to E2E (assign to 2nd store, confirm chip + close access).

### 7. "Per-store admin (admin of one store, not the whole account)" — GENUINELY OPEN ❌
- Today "Make Admin" (`setEmployeeAdminAccess` → `PATCH /employees/:id/admin-access`)
  flips the **global** `User.role` to `STORE_OWNER`, granting **account-wide** admin —
  exactly what the user does NOT want.
- Good news: the schema already has `EmployeeRole { OWNER, EMPLOYEE, MANAGER }` per
  assignment row (`schema.prisma:22`). **`MANAGER` is defined but unused** — it's the
  natural home for store-scoped admin.
- **Action (real feature, data-model + authz):**
  1. Use `Employee.role = MANAGER` on a specific (user, store) row = "admin of THIS store".
  2. New endpoint `PATCH /employees/:id/store-role { role: MANAGER|EMPLOYEE }` (per row),
     distinct from the existing account-wide admin toggle (keep both: "account admin"
     vs "store manager").
  3. Authz: today scoping is global via `ownerId`. Add manager checks so a MANAGER gets
     admin powers **only for stores where they hold a MANAGER row** (employees list,
     receipts, history, edits scoped to those store ids) — NOT owner-wide billing/delete.
  4. `request-user.ts`/`supabase-auth.service.ts`: surface the set of managed store ids.
  5. Web: replace the single "Make Admin" button with per-chip "Make manager of this store"
     vs the existing account-admin toggle.
- This is the largest item; ship it last and behind careful authz tests.

---

## Stress-test plan (the file's explicit mandate)

After the above, run a full prod-parity E2E sweep on the **staging API → gvlycd**
(shared DB — non-destructive accounts only), covering each surface a real owner touches:

1. **Auth:** owner signup (email+phone), sign-in, forgot-password EMAIL (link lands on
   dailyclose.us, not localhost), forgot-password PHONE OTP (blocked until Twilio TF approved).
2. **Employees:** invite by email (welcome email delivered) + by phone; appears instantly
   with correct store chip; assign to 2nd store; demote/remove; per-store manager (item 7).
3. **Stores:** create / edit / soft-delete; long-list show-more.
4. **Close flow:** employee close, owner close, OCR upload, idempotency (double submit),
   short/over status, store-local day boundary.
5. **Receipts & history:** long-list show-more on mobile viewport; PDF/CSV export.
6. **Billing:** subscription gate on invite/assign; $49.99 live checkout; webhook signature.
7. **Account:** change password, self-delete (anonymization), session refresh.

Capture each as pass/fail with the actual response; iterate until green. Treat empty-state,
single-item, and large-N (50+) cases explicitly per surface.

---

## Suggested execution order (smallest risk → largest)

1. **Item 4** — Supabase Site URL + redirect allow-list (config only; unblocks every reset email). *Needs `sbp_` token.*
2. **Item 3** — optimistic store-chip fix (tiny web change).
3. **Item 5** — show-more component across receipts / stores / history / employees.
4. **Verify items 1, 2, 6 on prod** + fold into E2E.
5. **Item 7** — per-store manager role (schema-aware backend authz + UI). Largest; do last.
6. **Full stress-test sweep**; iterate to green; promote `staging → main`.

## Blockers / inputs needed from you
- **Supabase `sbp_` token** (for item 4 — Site URL/redirect config; service-role key can't change auth config).
- Confirm whether the "no confirmation email" complaint was an **email** invite (should work) or a **phone** invite (waiting on Twilio toll-free verification — external).
- Sign-off on item 7's model: "account admin" (current) **plus** new per-store "manager" — keep both? (recommended).
