#!/usr/bin/env bash
# Seed a DEDICATED Play/App Store reviewer demo account on the app's backend.
# Separate from the partner's owner@demo.com (uses rev-* ids + a different email).
# Idempotent + additive (safe to re-run; cannot overwrite real data).
#
# Creates login:  reviewer@dailyclose.us  /  Reviewer1234!  (STORE_OWNER)
# plus 3 sample stores + 2 closes (from supabase/seed-reviewer.sql).
#
# Needs: psql, curl, python3 — and these (read from local env files if present,
# or export them yourself first):
#   DATABASE_URL                  (the app's Postgres / Supabase DB url)
#   SUPABASE_SERVICE_ROLE_KEY     (admin key for the same project)
# Usage:
#   bash scripts/seed-demo-reviewer.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SUPA="https://gvlycdpjaxewlwgspiqz.supabase.co"
EMAIL="reviewer@dailyclose.us"
PASS="Reviewer1234!"

: "${DATABASE_URL:=$(grep -hE '^DATABASE_URL=' .env.staging.local 2>/dev/null | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"')}"
: "${SUPABASE_SERVICE_ROLE_KEY:=$(grep -hE '^SUPABASE_SERVICE_ROLE_KEY=' apps/api/.env apps/api/.env.local apps/api/.env.staging.local .env.staging.local .env 2>/dev/null | head -1 | sed 's/^[^=]*=//' | tr -d '"')}"

[ -z "${DATABASE_URL:-}" ]              && { echo "ERROR: DATABASE_URL not set (and not found in .env.staging.local)."; exit 1; }
[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && { echo "ERROR: SUPABASE_SERVICE_ROLE_KEY not set. Export it, then re-run."; exit 1; }
SRK="$SUPABASE_SERVICE_ROLE_KEY"

echo "Target project: $SUPA"
echo "Reviewer login: $EMAIL"
echo
echo "1/3  Seeding reviewer's stores/closes (idempotent)..."
psql "$DATABASE_URL" -f supabase/seed-reviewer.sql

echo
echo "2/3  Creating the login + linking..."
resp=$(curl -s -X POST "$SUPA/auth/v1/admin/users" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"email_confirm\":true,\"user_metadata\":{\"name\":\"Play Reviewer\",\"role\":\"STORE_OWNER\"}}")
uid=$(printf '%s' "$resp" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
if [ -z "$uid" ]; then
  uid=$(curl -s "$SUPA/auth/v1/admin/users?per_page=300" -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
    | python3 -c "import sys,json;print(next((u['id'] for u in json.load(sys.stdin).get('users',[]) if u.get('email')=='$EMAIL'),''))" 2>/dev/null || true)
fi
[ -z "$uid" ] && { echo "ERROR: could not create/find $EMAIL"; echo "API said: $resp"; exit 1; }
psql "$DATABASE_URL" -q -c "update public.users set auth_user_id='$uid' where email='$EMAIL';"
echo "  ok  $EMAIL -> $uid"

echo
echo "3/3  Verifying..."
psql "$DATABASE_URL" -t -c "select u.email, u.role, (u.auth_user_id is not null) as has_login, count(s.id) as stores
  from public.users u left join public.owners o on o.user_id=u.id left join public.stores s on s.owner_id=o.id
  where u.email='$EMAIL' group by u.email,u.role,u.auth_user_id;"
echo
echo "Done. Reviewer login:  $EMAIL  /  $PASS"
echo "owner@demo.com was NOT touched."
