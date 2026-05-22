/* eslint-disable */
// Create Supabase Auth users for the seeded demo accounts and link auth_user_id.
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=sb_secret_... \
//   SUPABASE_DB_URL=postgresql://... \
//   node scripts/create-supabase-auth-users.js
const { createClient } = require("@supabase/supabase-js");
const { Client } = require("pg");

const USERS = [
  { email: "owner@demo.com", password: "Demo1234!", name: "Sam Owner", role: "STORE_OWNER" },
  { email: "maya@demo.com", password: "Demo1234!", name: "Maya", role: "EMPLOYEE" },
  { email: "chris@demo.com", password: "Demo1234!", name: "Chris", role: "EMPLOYEE" }
];

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_DB_URL) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL");
    process.exit(1);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const db = new Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  for (const u of USERS) {
    // Idempotent: try to find an existing auth user by listing (paginated, small org so 1 page is fine).
    let authId = null;
    const { data: existing, error: listErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (listErr) throw listErr;
    const found = existing.users.find((x) => x.email === u.email);
    if (found) {
      authId = found.id;
      console.log(`  • ${u.email}: existing auth user ${authId}`);
    } else {
      const { data, error } = await sb.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name, role: u.role }
      });
      if (error) throw new Error(`${u.email}: ${error.message}`);
      authId = data.user.id;
      console.log(`  ✓ ${u.email}: created auth user ${authId}`);
    }

    const upd = await db.query(
      "UPDATE public.users SET auth_user_id = $1 WHERE email = $2 RETURNING id",
      [authId, u.email]
    );
    console.log(
      `    linked auth_user_id on public.users (${upd.rowCount} row${upd.rowCount === 1 ? "" : "s"})`
    );
  }

  console.log("\nDemo password for all 3 users: Demo1234!");
  console.log("Change it after first sign-in via the forgot-password flow.");
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
