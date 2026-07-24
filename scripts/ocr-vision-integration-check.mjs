/* eslint-disable */
/**
 * Proves the real service path: sharp downscale (1600px) + official SDK call
 * with output_config, against the hardest photos. Confirms the production code
 * (not just the raw-fetch harness) reads correctly at reduced resolution.
 *
 *   node scripts/ocr-vision-integration-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES = path.join(HERE, "ocr-samples");
const key = fs.readFileSync(path.join(HERE, "..", "apps", "api", ".env"), "utf8").match(/ANTHROPIC_API_KEY\s*=\s*(.+)/)[1].trim();
const client = new Anthropic({ apiKey: key });

const SYSTEM = fs.readFileSync(path.join(HERE, "..", "apps", "api", "src", "ocr", "anthropic-vision.service.ts"), "utf8")
  .match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/)[1];

const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    format: { type: "string", enum: ["clover", "nrs_terminal", "other"] },
    storeName: { type: "string" }, reportDate: { type: "string" },
    grossSales: { type: "number" }, netSales: { type: "number" }, cashSales: { type: "number" },
    debitCardSales: { type: "number" }, creditCardSales: { type: "number" }, cardSalesTotal: { type: "number" },
    tax: { type: "number" }, refunds: { type: "number" }, discounts: { type: "number" },
    amountCollected: { type: "number" }, confidence: { type: "number" },
  },
  required: ["format","storeName","reportDate","grossSales","netSales","cashSales","debitCardSales","creditCardSales","cardSalesTotal","tax","refunds","discounts","amountCollected","confidence"],
};

const CHECK = {
  "7190-clover-jul10-drift.jpeg": { gross: 1060.92, cash: 308.20, card: 797.88, tax: 74.81 },
  "7277-clover-jul12-rotated.jpeg": { gross: 991.13, cash: 296.60, card: 761.02, tax: 71.49 },
  "7191-nrs-terminal-jul11-rotated.jpeg": { gross: 3085.49, cash: 1073.18, card: 2012.31, tax: 201.59 },
};

for (const [file, exp] of Object.entries(CHECK)) {
  const original = fs.readFileSync(path.join(SAMPLES, file));
  const resized = await sharp(original).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  const res = await client.messages.create({
    model: "claude-opus-4-8", max_tokens: 4096, system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: resized.toString("base64") } },
      { type: "text", text: "Extract the daily totals from this sales report." },
    ] }],
  });
  const block = res.content.find((b) => b.type === "text");
  const p = JSON.parse(block.text);
  const ok = (a, b) => Math.abs(a - b) < 0.005 ? "OK" : "XX";
  console.log(`\n${file}  (${(original.length/1024).toFixed(0)}KB -> ${(resized.length/1024).toFixed(0)}KB, ${res.usage.input_tokens} in / ${res.usage.output_tokens} out tokens)`);
  console.log(`  gross ${p.grossSales} ${ok(p.grossSales, exp.gross)}   cash ${p.cashSales} ${ok(p.cashSales, exp.cash)}   card ${p.cardSalesTotal} ${ok(p.cardSalesTotal, exp.card)}   tax ${p.tax} ${ok(p.tax, exp.tax)}   conf ${p.confidence}`);
}
