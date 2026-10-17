// Benchmarks a running inference service with real recordings, using the app's own
// prompt, schema and output validation.
//
// Usage: INFERENCE_BASE_URL=... INFERENCE_API_KEY=... npx tsx scripts/benchmark-inference.ts <samples_dir> <samples.json>
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  buildExtractionInstructions,
  extractionJsonSchema,
  processModelOutput,
  wrapNotes,
} from "../src/lib/extraction";

type Sample = { id: string; text: string; expected: { totalCostNaira: number | null; parts: { name: string }[] } };

const [samplesDir, samplesJson] = process.argv.slice(2);
const base = process.env.INFERENCE_BASE_URL ?? "http://127.0.0.1:7860";
const key = process.env.INFERENCE_API_KEY ?? "";
const samples: Sample[] = JSON.parse(readFileSync(samplesJson, "utf8"));
const today = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);

function normalise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Word error rate (substitutions + deletions + insertions) / reference words. */
function wer(reference: string, hypothesis: string): number {
  const r = normalise(reference);
  const h = normalise(hypothesis);
  let prev = Array.from({ length: h.length + 1 }, (_, j) => j);
  for (let i = 1; i <= r.length; i++) {
    const cur = [i];
    for (let j = 1; j <= h.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[h.length] / r.length;
}

async function post(pathname: string, body: BodyInit, type: string) {
  const started = performance.now();
  const res = await fetch(new URL(pathname, base), {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": type },
    body,
    signal: AbortSignal.timeout(290_000),
  });
  const wall = Math.round(performance.now() - started);
  return { status: res.status, json: (await res.json()) as Record<string, unknown>, wall };
}

async function main() {
const files = readdirSync(samplesDir).filter((f) => f.endsWith(".webm")).sort();
const rows: string[] = [];
for (const file of files) {
  const id = file.replace(/(-noisy)?\.webm$/, "");
  const sample = samples.find((s) => s.id === id);
  if (!sample) continue;
  const audio = readFileSync(path.join(samplesDir, file));

  const t = await post("/v1/transcribe", audio, "audio/webm");
  if (t.status !== 200) {
    rows.push(`| ${file} | transcribe failed ${t.status} ${JSON.stringify(t.json)} |`);
    continue;
  }
  const transcript = String(t.json.text);
  const duration = Number(t.json.durationSec);

  const e = await post(
    "/v1/extract",
    JSON.stringify({ instructions: buildExtractionInstructions(today), text: wrapNotes(transcript), schema: extractionJsonSchema }),
    "application/json",
  );
  let summary = `extract failed ${e.status}`;
  if (e.status === 200) {
    const processed = processModelOutput(String(e.json.content), transcript, today);
    if (!processed.ok) summary = "malformed output";
    else {
      const f = processed.fields;
      const total = f.totalCostKobo === null ? "–" : f.totalCostKobo / 100;
      const expectedTotal = sample.expected.totalCostNaira ?? "–";
      summary =
        `parts ${f.partsReplaced.length}/${sample.expected.parts.length}, total ${total} (exp ${expectedTotal}), ` +
        `flags ${processed.flags.map((x) => `${x.field}:${x.reason}`).join(" ") || "none"}`;
      console.log(`\n--- ${file}\nTRANSCRIPT: ${transcript}\nRAW: ${e.json.content}\nFIELDS: ${JSON.stringify(f)}`);
    }
  }
  rows.push(
    `| ${file} | ${duration.toFixed(1)} s | ${t.wall} ms (${(t.wall / 1000 / duration).toFixed(2)}× RT) | ` +
      `${(wer(sample.text, transcript) * 100).toFixed(1)}% | ${e.wall} ms | ${e.json.completionTokens ?? "?"} | ${summary} |`,
  );
  console.log(`ROW ${rows.at(-1)}`);
}

console.log("\n| Sample | Audio | Transcribe (wall) | WER | Extract (wall) | Out tokens | Extraction vs expected |");
console.log("|---|---|---|---|---|---|---|");
for (const row of rows) console.log(row);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
