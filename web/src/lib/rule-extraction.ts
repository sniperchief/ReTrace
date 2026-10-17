/**
 * Rule-based extraction: fills repair fields from a technician's notes using
 * simple sentence patterns and a list of generator part names. No AI model.
 *
 * It only copies what the notes say, so it can't invent details, but it will
 * miss information phrased in unusual ways. It produces the same shape as the
 * model output (`extractionJsonSchema`) and goes through the same validation.
 * Used on its own when the AI is off or fails, and to fill fields the AI left
 * empty.
 */

type RawPart = { name: string; quantity: number | null; costNaira: number | null };
export type RuleOutput = {
  repairDate: string | null;
  reportedSymptoms: string | null;
  diagnosis: string | null;
  workPerformed: string | null;
  partsReplaced: RawPart[];
  totalCostNaira: number | null;
  technicianNotes: string | null;
};

/** Generator parts, longest names first so "spark plug" wins over "plug". */
const PARTS: [pattern: string, name: string][] = (
  [
    ["spark plugs?", "Spark plug"],
    ["ignition coils?", "Ignition coil"],
    ["recoil starters?|pull starters?", "Recoil starter"],
    ["piston rings?", "Piston rings"],
    ["head gaskets?", "Head gasket"],
    ["gasket kits?", "Gasket kit"],
    ["air filters?", "Air filter"],
    ["fuel filters?", "Fuel filter"],
    ["oil filters?", "Oil filter"],
    ["engine oil", "Engine oil"],
    ["oil seals?", "Oil seal"],
    ["fuel pumps?", "Fuel pump"],
    ["fuel taps?", "Fuel tap"],
    ["fuel lines?|fuel hoses?", "Fuel line"],
    ["carbu?rett?ors?|carbs?", "Carburettor"],
    ["a\\.?\\s?v\\.?\\s?r\\.?s?|automatic voltage regulators?", "AVR"],
    ["capacitors?", "Capacitor"],
    ["diodes?", "Diode"],
    ["stators?", "Stator"],
    ["rotors?", "Rotor"],
    ["carbon brushes|brushes", "Brushes"],
    ["bearings?", "Bearing"],
    ["batter(?:y|ies)", "Battery"],
    ["injectors?", "Injector"],
    ["pistons?", "Piston"],
    ["exhaust|mufflers?|silencers?", "Exhaust"],
    ["fan belts?|belts?", "Belt"],
    ["starter motors?|starters?", "Starter"],
    ["switch(?:es)?", "Switch"],
    ["sockets?", "Socket"],
    ["fuses?", "Fuse"],
    ["coils?", "Coil"],
    ["plugs?", "Spark plug"],
    ["gaskets?", "Gasket"],
    ["valves?", "Valve"],
    ["flywheels?", "Flywheel"],
    ["crankshafts?", "Crankshaft"],
  ] as [string, string][]
).sort((a, b) => b[0].length - a[0].length);

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  new: 1, single: 1, pair: 2, couple: 2,
};
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const ADVICE = /\b(advis\w*|told (?:him|her|them|the (?:customer|owner|client))|recommend\w*|should|must|next time|bring it back|come back|warned)\b/i;
const COMPLAINT =
  /\b(?:(?:customer|client|owner|he|she|they|madam|oga)\s+(?:said|says|complained|complains|reported|told me|called)|complain\w*|the (?:problem|issue|complaint) (?:is|was))\b/i;
// Includes common Nigerian Pidgin ("no gree start", "no dey work", "dey off").
const SYMPTOM_PHRASE =
  /\b(?:won'?t|wouldn'?t|would not|will not|does not|doesn'?t|did not|didn'?t|not|no|no gree|no dey|refus\w*)\s+(?:start|come on|work|run|pick|power|on)\w*|\b(?:goes off|going off|went off|dey off|shuts? (?:down|off)|fluctuat\w*|smok\w+|nois[ey]\w*|rattl\w*|overheat\w*|leak\w*|vibrat\w*)\b/i;
const WORK =
  /\b(changed|change|replaced|replace|installed|fixed|repaired|cleaned|serviced|tightened|rewound|rewind\w*|drained|flushed|adjusted|welded|fitted|put (?:a |an |in )?new|bought|topped up|refilled|soldered|reconnected)\b/i;
const REPLACE = /\b(changed|change|replaced|replace|installed|fitted|put (?:a |an |in )?new|bought|new)\b/i;
const DIAGNOSIS =
  /\b(found|discovered|noticed|realis\w*|realiz\w*|diagnos\w*|the (?:fault|cause|problem) (?:is|was)|(?:was|were|is|are|don) (?:very |completely |totally |a bit )?(?:faulty|bad|dead|die|burnt|burned|burn|blocked|dirty|worn|loose|weak|damaged|spoil|spoilt|spoiled|broken|cut|shorted|leaking|empty|low|jammed|stuck|clogged|corroded))\b/i;
const TOTAL = /\b(total|charged|charge|altogether|in all|bill|collected)\b/i;
const AMOUNT = /(?:₦|\bN|\bNGN)\s?(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?|(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?\s*(?:naira|nira|nara|ngn|₦)|(\d[\d,]*(?:\.\d+)?)\s*k\b/gi;

function amountsIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(AMOUNT)) {
    const digits = m[1] ?? m[3] ?? m[5];
    const unit = m[2] ?? m[4] ?? (m[5] ? "k" : undefined);
    let value = Number(digits.replace(/,/g, ""));
    if (unit) value *= 1000;
    if (Number.isFinite(value) && value > 0) out.push(value);
  }
  return out;
}

function sentences(notes: string): string[] {
  return notes
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim().replace(/^[,;:\-\s]+/, ""))
    .filter((s) => s.length > 2);
}

/** "The customer said that it would not start." → "It would not start" */
function cleanSymptom(sentence: string): string {
  return tidy(
    sentence
      .replace(/^.*?\b(?:said|says|complained|complains|reported|told me)\b(?:\s+that)?\s*/i, "")
      .replace(/^.*?\bbrought it\b.*?\bbecause\s+/i, ""),
  );
}

/** Work text without money phrases: "I replaced the AVR for 18,000 naira" → "I replaced the AVR". */
function withoutAmounts(sentence: string): string {
  const money = String.raw`(?:(?:₦|\bN|\bNGN)\s?\d[\d,]*(?:\.\d+)?\s*(?:k|thousand)?|\d[\d,]*(?:\.\d+)?\s*(?:k|thousand)?\s*(?:naira|nira|nara|ngn|₦)|\d[\d,]*(?:\.\d+)?\s*k\b)`;
  return sentence
    .replace(new RegExp(String.raw`,?\s*(?:\b(?:that was|which was|it was|was|is|for|at|cost(?:ing)?)\b)?\s*${money}(?:\s+for the \w+)?`, "gi"), "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*(?=[.;]|$)/g, "");
}

function tidy(text: string): string {
  const t = text.trim().replace(/[.;,\s]+$/, "");
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/**
 * Parts replaced in a sentence. The sentence is split into clauses ("I replaced
 * the AVR and cleaned the air filter"); a clause without its own verb carries
 * on the previous one ("replaced the rings, and the gasket kit was 2500").
 * Only clauses whose verb means replacement count, so a cleaned part isn't a
 * replaced part.
 */
function partsIn(sentence: string): RawPart[] {
  const parts: RawPart[] = [];
  let replacing = false;
  for (const clause of sentence.split(CLAUSE_SPLIT)) {
    if (REPLACE.test(clause)) replacing = true;
    else if (WORK.test(clause)) replacing = false;
    if (!replacing) continue;
    for (const p of partsInClause(clause)) {
      const existing = parts.find((x) => x.name === p.name);
      if (!existing) parts.push(p);
      else if (existing.costNaira === null) existing.costNaira = p.costNaira;
    }
  }
  // A cost said in a following clause ("..., that was 6000 for the rings" or
  // "engine oil, 1 litre, 4500 naira") belongs to the part before it.
  const clauses = sentence.split(/(?<!\d),(?!\d)\s*/);
  for (const part of parts) {
    if (part.costNaira !== null) continue;
    const i = clauses.findIndex((c) => partsInClause(c).some((p) => p.name === part.name));
    for (const next of i >= 0 ? clauses.slice(i + 1, i + 3) : []) {
      if (partsInClause(next).length) break;
      const amount = amountsIn(next)[0];
      if (amount !== undefined) {
        part.costNaira = amount;
        break;
      }
    }
  }
  return parts;
}

/** Commas between digits ("18,000") are not clause breaks. */
const CLAUSE_SPLIT = /(?<!\d),(?!\d)\s*(?:and\s+)?|\s+and\s+|\s+then\s+/i;

function partsInClause(sentence: string): RawPart[] {
  const found: { index: number; length: number; name: string }[] = [];
  let masked = sentence;
  for (const [pattern, name] of PARTS) {
    const re = new RegExp(`\\b(?:${pattern})\\b`, "gi");
    for (const m of masked.matchAll(re)) {
      found.push({ index: m.index!, length: m[0].length, name });
      masked = masked.slice(0, m.index!) + " ".repeat(m[0].length) + masked.slice(m.index! + m[0].length);
    }
  }
  found.sort((a, b) => a.index - b.index);

  const parts: RawPart[] = [];
  found.forEach((p, i) => {
    if (parts.some((x) => x.name === p.name)) return;
    // Cost: the first amount after this part and before the next part.
    const end = found[i + 1]?.index ?? sentence.length;
    const after = sentence.slice(p.index + p.length, end);
    const before = sentence.slice(Math.max(0, p.index - 14), p.index).toLowerCase().trim().split(/\s+/);
    const countWord = before.at(-1) === "the" ? before.at(-2) : before.at(-1);
    const quantity = countWord ? (NUMBER_WORDS[countWord] ?? (/^\d{1,3}$/.test(countWord) ? Number(countWord) : null)) : null;
    parts.push({ name: p.name, quantity, costNaira: amountsIn(after)[0] ?? null });
  });
  return parts;
}

function dateIn(notes: string, today: string): string | null {
  const text = notes.toLowerCase();
  const todayDate = new Date(`${today}T00:00:00Z`);
  if (/\byesterday\b/.test(text)) return new Date(todayDate.getTime() - 86_400_000).toISOString().slice(0, 10);
  if (/\btoday\b|\bthis morning\b|\bthis afternoon\b/.test(text)) return today;
  const month = `(${MONTHS.join("|")})[a-z]*`;
  const m =
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?: of)? ${month}\\b`).exec(text) ??
    new RegExp(`\\b${month} (\\d{1,2})(?:st|nd|rd|th)?\\b`).exec(text);
  if (!m) return null;
  const [day, mon] = /^\d/.test(m[1]) ? [Number(m[1]), m[2]] : [Number(m[2]), m[1]];
  const monthIndex = MONTHS.indexOf(mon.slice(0, 3));
  if (monthIndex < 0 || day < 1 || day > 31) return null;
  let year = todayDate.getUTCFullYear();
  let date = new Date(Date.UTC(year, monthIndex, day));
  if (date > todayDate) date = new Date(Date.UTC(--year, monthIndex, day)); // a past date without a year
  return date.getUTCDate() === day ? date.toISOString().slice(0, 10) : null;
}

export function extractWithRules(notes: string, today: string): RuleOutput {
  const symptoms: string[] = [];
  const diagnosis: string[] = [];
  const work: string[] = [];
  const advice: string[] = [];
  const parts: RawPart[] = [];
  let total: number | null = null;

  for (const s of sentences(notes)) {
    const isTotal = TOTAL.test(s) && amountsIn(s).length > 0;
    if (isTotal) total = amountsIn(s).at(-1)!;

    if (ADVICE.test(s)) advice.push(tidy(s));
    else if (COMPLAINT.test(s)) symptoms.push(cleanSymptom(s));
    else if (WORK.test(s)) {
      work.push(tidy(withoutAmounts(s)));
      for (const p of partsIn(s)) if (!parts.some((x) => x.name === p.name)) parts.push(p);
    } else if (DIAGNOSIS.test(s)) diagnosis.push(tidy(s.replace(/^(?:when i opened it,?|i (?:checked|opened) it and|on checking,?)\s*/i, "")));
    else if (!isTotal && SYMPTOM_PHRASE.test(s) && symptoms.length === 0) symptoms.push(cleanSymptom(s));
  }

  const join = (items: string[]) => (items.filter(Boolean).length ? items.filter(Boolean).join("; ") : null);
  return {
    repairDate: dateIn(notes, today),
    reportedSymptoms: join(symptoms),
    diagnosis: join(diagnosis),
    workPerformed: join(work),
    partsReplaced: parts,
    totalCostNaira: total,
    technicianNotes: join(advice),
  };
}
