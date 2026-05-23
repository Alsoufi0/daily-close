/* eslint-disable */
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

(async () => {
  const auth = await fetch(
    "https://lgvcbdwylemvfictqmnz.supabase.co/auth/v1/token?grant_type=password",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: "sb_publishable_Bm1lSwpzEK4awXOz6WSXhA_59U2RUj5"
      },
      body: JSON.stringify({ email: "owner@demo.com", password: "Demo1234!" })
    }
  ).then((r) => r.json());
  const token = auth.access_token;
  console.log("signed in as", auth.user.email);

  const sb = createClient(
    "https://lgvcbdwylemvfictqmnz.supabase.co",
    "sb_publishable_Bm1lSwpzEK4awXOz6WSXhA_59U2RUj5",
    { global: { headers: { Authorization: "Bearer " + token } } }
  );

  const bytes = fs.readFileSync("receipt.jpg");
  const path = `store-1/2026-05-23/test-${Date.now()}.jpg`;
  const up = await sb.storage
    .from("pos-reports")
    .upload(path, bytes, { contentType: "image/jpeg" });
  if (up.error) {
    console.log("upload err", up.error);
    return;
  }
  const signed = await sb.storage.from("pos-reports").createSignedUrl(path, 3600);
  console.log("uploaded ->", signed.data.signedUrl.slice(0, 80) + "...");

  console.log("calling /daily-close/upload-report ...");
  const t0 = Date.now();
  const res = await fetch(
    "https://daily-close-api.onrender.com/daily-close/upload-report",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        storeId: "store-1",
        fileName: "receipt.jpg",
        contentType: "image/jpeg",
        imageUrl: signed.data.signedUrl
      })
    }
  );
  const ms = Date.now() - t0;
  const out = await res.json();
  console.log(`api responded in ${ms}ms`);
  console.log("---");
  console.log("parserType:", out.parserType);
  console.log("cashSales :", out.cashSales);
  console.log("cardSales :", out.cardSales);
  console.log("totalSales:", out.totalSales);
  console.log("tax       :", out.tax);
  console.log("discounts :", out.discounts);
})().catch((e) => console.error("ERR", e));
