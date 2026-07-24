/* eslint-disable */
/**
 * Local eval harness for the Claude vision receipt extractor.
 *
 * Runs each sample photo through the same prompt + schema the API will use,
 * then scores the result against hand-verified ground truth. No prod, no DB.
 *
 *   node scripts/ocr-vision-eval.mjs
 *
 * Reads ANTHROPIC_API_KEY from apps/api/.env (or the environment).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES = path.join(HERE, "ocr-samples");
const MODEL = process.env.OCR_ANTHROPIC_MODEL || "claude-opus-4-8";

// --- load key from apps/api/.env if not already in env ---
function loadKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const envPath = path.join(HERE, "..", "apps", "api", ".env");
  try {
    const text = fs.readFileSync(envPath, "utf8");
    const m = text.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim();
  } catch {}
  throw new Error("ANTHROPIC_API_KEY not found in env or apps/api/.env");
}
const API_KEY = loadKey();

// --- ground truth (hand-verified from the photos) ---
// cardSalesTotal = debitCardSales + creditCardSales (what the app stores as cardSales)
const GROUND_TRUTH = {
  "7278-clover-jul12-rotated.jpeg": { format: "clover", grossSales: 991.13, cashSales: 296.60, cardSalesTotal: 761.02, tax: 71.49, discounts: 5.00 },
  "7277-clover-jul12-rotated.jpeg": { format: "clover", grossSales: 991.13, cashSales: 296.60, cardSalesTotal: 761.02, tax: 71.49, discounts: 5.00 },
  "7186-clover-jul11-clean.jpeg":   { format: "clover", grossSales: 890.59, cashSales: 205.70, cardSalesTotal: 749.39, tax: 64.50, discounts: 0 },
  "7189-clover-jul11-fabric.jpeg":  { format: "clover", grossSales: 900.76, cashSales: 205.70, cardSalesTotal: 760.30, tax: 65.24, discounts: 0 },
  "7188-clover-jul10-clean.jpeg":   { format: "clover", grossSales: 1060.92, cashSales: 308.20, cardSalesTotal: 797.88, tax: 74.81, discounts: 0 },
  "7190-clover-jul10-drift.jpeg":   { format: "clover", grossSales: 1060.92, cashSales: 308.20, cardSalesTotal: 797.88, tax: 74.81, discounts: 0 },
  "7187-clover-jul12-bucket.jpeg":  { format: "clover", grossSales: 995.41, cashSales: 297.98, cardSalesTotal: 764.23, tax: 71.80, discounts: 5.00 },
  "7191-nrs-terminal-jul11-rotated.jpeg": { format: "nrs_terminal", grossSales: 3085.49, cashSales: 1073.18, cardSalesTotal: 2012.31, tax: 201.59, discounts: 0 },
  // Clover with nested tender breakdown (Debit=Visa+MasterCard, Credit=Visa+MasterCard);
  // must sum the PARENT Debit+Credit lines, not double-count the sub-rows.
  "newbatch-clover-jul23-subtender-rotated.jpeg": { format: "clover", grossSales: 760.75, cashSales: 259.50, cardSalesTotal: 556.40, tax: 55.15, discounts: 0 },
};

const SYSTEM = `You read a photo of a point-of-sale end-of-day sales report (a "Z report" / "Sales Overview" / "Terminal Report") and extract the daily totals as structured JSON.

These photos are taken by store employees on their phones. They may be rotated 90/180 degrees, crumpled, curled, shot at an angle, or lie on a busy background. Read the printed receipt regardless of orientation. If perspective makes the left label column and the right value column drift vertically relative to each other, pair each label with the value on its own printed row — reconcile using the receipt's own math (see rules).

Extract ONLY the store-level daily totals from the summary sections (e.g. "SALES SUMMARY", "SALES BY TENDER TYPE", "TOTAL CASH DEPOSIT", "Taxes And Fees Collection Summary"). NEVER take numbers from a per-employee breakdown ("SALES BY EMPLOYEES", a person's name like "Moe"/"Von") — those are a subset and will be wrong.

Field rules:
- cashSales: total cash sales (Clover "Cash (n)" tender line, or "Cash Sales"; NRS/Terminal "Cash").
- debitCardSales / creditCardSales: on Clover these are two separate tender lines ("Debit Card (n)" and "Credit Card (n)"). Read each.
- cardSalesTotal: total non-cash card sales = debitCardSales + creditCardSales. On an NRS/Terminal report with a single "Credit/Debit" line, cardSalesTotal is that line and debit/credit split is 0.
- grossSales: "Gross Sales" if present, else "Total Sales"/"Net Sales"/"Taxable Product Sales".
- netSales: "Net Sales" if present, else same as grossSales.
- tax: "Taxes & Fees" / "Sales Tax" / "Total Tax and Fees".
- discounts: shown like "Discounts (1)  ($5.00)" — return the positive magnitude (5.00). 0 if absent.
- refunds: 0 if absent.
- amountCollected: "Amount Collected" if present.
- reportDate: the report's business date if printed (YYYY-MM-DD), else "".

Reconciliation (use to self-check and fix column drift): cashSales + cardSalesTotal should equal amountCollected (tax-inclusive) when Amount Collected is present. If your first read doesn't reconcile, re-read the columns.

Return every monetary field as a plain number (dollars, no "$" or commas). Use 0 for anything genuinely absent from the report. Set confidence 0..1 for how sure you are of cashSales, cardSalesTotal, grossSales, and tax together.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    format: { type: "string", enum: ["clover", "nrs_terminal", "other"] },
    storeName: { type: "string" },
    reportDate: { type: "string" },
    grossSales: { type: "number" },
    netSales: { type: "number" },
    cashSales: { type: "number" },
    debitCardSales: { type: "number" },
    creditCardSales: { type: "number" },
    cardSalesTotal: { type: "number" },
    tax: { type: "number" },
    refunds: { type: "number" },
    discounts: { type: "number" },
    amountCollected: { type: "number" },
    confidence: { type: "number" },
  },
  required: [
    "format", "storeName", "reportDate", "grossSales", "netSales", "cashSales",
    "debitCardSales", "creditCardSales", "cardSalesTotal", "tax", "refunds",
    "discounts", "amountCollected", "confidence",
  ],
};

function mediaTypeFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function extract(file) {
  const bytes = fs.readFileSync(path.join(SAMPLES, file));
  const b64 = bytes.toString("base64");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaTypeFor(file), data: b64 } },
            { type: "text", text: "Extract the daily totals from this sales report." },
          ],
        },
      ],
    }),
  });
  const body = await res.json();
  if (body.type === "error") throw new Error(JSON.stringify(body.error));
  const textBlock = (body.content || []).find((b) => b.type === "text");
  if (!textBlock) throw new Error("no text block in response: " + JSON.stringify(body).slice(0, 300));
  return { parsed: JSON.parse(textBlock.text), usage: body.usage };
}

const FIELDS = ["grossSales", "cashSales", "cardSalesTotal", "tax", "discounts"];
const money = (n) => (typeof n === "number" ? n.toFixed(2).padStart(9) : String(n).padStart(9));

(async () => {
  const files = Object.keys(GROUND_TRUTH);
  let totalFields = 0, correctFields = 0;
  const perFile = [];

  for (const file of files) {
    process.stdout.write(`\n${file}\n`);
    let parsed, usage;
    try {
      ({ parsed, usage } = await extract(file));
    } catch (e) {
      console.log("  ERROR:", e.message);
      continue;
    }
    const gt = GROUND_TRUTH[file];
    let fileCorrect = 0;
    console.log("  field            expected      got   ok");
    for (const f of FIELDS) {
      const exp = gt[f];
      const got = parsed[f];
      const ok = typeof got === "number" && Math.abs(got - exp) < 0.005;
      totalFields++; if (ok) { correctFields++; fileCorrect++; }
      console.log(`  ${f.padEnd(15)} ${money(exp)} ${money(got)}   ${ok ? "OK" : "XX"}`);
    }
    const fmtOk = parsed.format === gt.format;
    console.log(`  format=${parsed.format} (${fmtOk ? "OK" : "exp " + gt.format}) confidence=${parsed.confidence} tokens=${usage?.output_tokens ?? "?"}`);
    perFile.push({ file, score: `${fileCorrect}/${FIELDS.length}` });
  }

  console.log("\n================ SUMMARY ================");
  for (const r of perFile) console.log(`  ${r.score}   ${r.file}`);
  console.log(`\n  OVERALL: ${correctFields}/${totalFields} fields correct (${((correctFields / totalFields) * 100).toFixed(1)}%)`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
