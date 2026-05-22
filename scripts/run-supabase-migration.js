/* eslint-disable */
// One-shot bootstrap: runs both migrations + seed against the Supabase Postgres.
// Usage: SUPABASE_DB_URL=postgresql://... node scripts/run-supabase-migration.js
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const files = [
  "supabase/migrations/001_production_schema.sql",
  "supabase/migrations/002_subscriptions.sql",
  "supabase/seed.sql"
];

async function main() {
  const conn = process.env.SUPABASE_DB_URL;
  if (!conn) {
    console.error("Missing SUPABASE_DB_URL");
    process.exit(1);
  }
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected.");

  for (const rel of files) {
    const abs = path.join(__dirname, "..", rel);
    const sql = fs.readFileSync(abs, "utf8");
    console.log(`\n>> ${rel} (${sql.length} bytes)`);
    try {
      await client.query(sql);
      console.log("   ✓ applied");
    } catch (err) {
      console.error(`   ✗ ${err.message}`);
      throw err;
    }
  }

  console.log("\n--- verification ---");
  const checks = [
    ["users", "SELECT count(*) FROM public.users"],
    ["owners", "SELECT count(*) FROM public.owners"],
    ["stores", "SELECT count(*) FROM public.stores"],
    ["employees", "SELECT count(*) FROM public.employees"],
    ["daily_close", "SELECT count(*) FROM public.daily_close"],
    ["notifications", "SELECT count(*) FROM public.notifications"],
    [
      "owners(trial fields)",
      "SELECT count(*) FROM public.owners WHERE trial_ends_at IS NOT NULL"
    ]
  ];
  for (const [label, q] of checks) {
    const res = await client.query(q);
    console.log(`   ${label.padEnd(24)} ${res.rows[0].count}`);
  }

  await client.end();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
