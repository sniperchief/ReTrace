import "server-only";
import type { ObjectId } from "mongodb";
import type { RepairSearch } from "@/lib/schemas/search";
import { escapeRegex, tokenize } from "@/lib/search";
import { collections, type RepairDoc } from "./collections";
import { toObjectId } from "./ids";
import { toRepair, type RepairWithGenerator } from "./repairs";

/**
 * Keyword search over a technician's CONFIRMED repairs (drafts are never
 * searched). Matching is word-prefix and case-insensitive ("plug" matches
 * "Spark plug" and "plugs", not "unplugged"); it is not semantic, so
 * "won't start" does not find "hard to start" unless they share words.
 *
 * Every query is filtered by technicianId first; generator matches are looked
 * up within the same technician only.
 */

export type MatchField = "generator" | "reportedSymptoms" | "diagnosis" | "workPerformed" | "parts" | "technicianNotes" | "originalNotes";

export type SearchHit = RepairWithGenerator & { matchedIn: MatchField[]; score: number };

export type SearchResult = { hits: SearchHit[]; truncated: boolean };

/** Upper bound on records scored per search; enough for one technician's history. */
const CANDIDATE_LIMIT = 300;
const MAX_TERMS = 6;

const WEIGHTS: Record<MatchField, number> = {
  reportedSymptoms: 3,
  diagnosis: 3,
  workPerformed: 3,
  parts: 3,
  generator: 2,
  technicianNotes: 2,
  originalNotes: 1,
};

/** Word-prefix pattern that both MongoDB (PCRE) and JavaScript understand. */
function wordPrefixPattern(term: string): string {
  return `(?:^|[^A-Za-z0-9])${escapeRegex(term)}`;
}

function searchTerms(q: string | undefined): string[] {
  return tokenize(q ?? "")
    .filter((t) => t.length >= 2)
    .slice(0, MAX_TERMS);
}

function textFields(doc: RepairDoc): Record<Exclude<MatchField, "generator">, string[]> {
  const notes: string[] = [];
  if (doc.source.kind === "voice") notes.push(doc.source.transcript ?? "", doc.source.editedText ?? "");
  if (doc.source.kind === "text") notes.push(doc.source.typedText, doc.source.editedText ?? "");
  return {
    reportedSymptoms: [doc.reportedSymptoms ?? ""],
    diagnosis: [doc.diagnosis ?? ""],
    workPerformed: [doc.workPerformed ?? ""],
    parts: doc.partsReplaced.map((p) => p.name),
    technicianNotes: [doc.technicianNotes ?? ""],
    originalNotes: notes,
  };
}

export async function searchRepairs(technicianId: string, search: RepairSearch): Promise<SearchResult> {
  const terms = searchTerms(search.q);
  // Words that contain nothing searchable (e.g. only punctuation) match nothing, rather than everything.
  if (search.q?.trim() && terms.length === 0) return { hits: [], truncated: false };
  const filter: Record<string, unknown> = { technicianId, status: "confirmed" };

  if (search.generator) {
    const generatorId = toObjectId(search.generator);
    // A generator that isn't this technician's simply matches nothing.
    const owned = generatorId && (await collections.generators().countDocuments({ _id: generatorId, technicianId }, { limit: 1 }));
    if (!owned) return { hits: [], truncated: false };
    filter.generatorId = generatorId;
  }

  if (search.from || search.to) {
    // Undated records can't be placed in a date range, so a date filter excludes them.
    filter.repairDate = {
      $ne: null,
      ...(search.from ? { $gte: new Date(`${search.from}T00:00:00Z`) } : {}),
      ...(search.to ? { $lte: new Date(`${search.to}T00:00:00Z`) } : {}),
    };
  }

  if (search.part) {
    const partTerms = searchTerms(search.part);
    if (partTerms.length) {
      filter.$and = partTerms.map((t) => ({
        "partsReplaced.name": { $regex: wordPrefixPattern(t), $options: "i" },
      }));
    }
  }

  // Generators (of this technician) whose details or owner match each term.
  const generatorsByTerm = new Map<string, ObjectId[]>();
  for (const term of terms) {
    const ids = await collections
      .generators()
      .find({ technicianId, searchKeys: { $regex: `^${escapeRegex(term)}` } }, { projection: { _id: 1 } })
      .limit(500)
      .map((g) => g._id)
      .toArray();
    generatorsByTerm.set(term, ids);
  }

  if (terms.length) {
    const termConditions = terms.map((term) => {
      const re = { $regex: wordPrefixPattern(term), $options: "i" };
      const ids = generatorsByTerm.get(term) ?? [];
      return {
        $or: [
          { reportedSymptoms: re },
          { diagnosis: re },
          { workPerformed: re },
          { technicianNotes: re },
          { "partsReplaced.name": re },
          { "source.transcript": re },
          { "source.typedText": re },
          { "source.editedText": re },
          ...(ids.length ? [{ generatorId: { $in: ids } }] : []),
        ],
      };
    });
    filter.$and = [...((filter.$and as object[]) ?? []), ...termConditions];
  }

  const docs = await collections
    .repairs()
    .find(filter)
    .sort({ repairDate: -1, createdAt: -1 })
    .limit(CANDIDATE_LIMIT + 1)
    .toArray();
  const truncated = docs.length > CANDIDATE_LIMIT;
  const candidates = docs.slice(0, CANDIDATE_LIMIT);

  const labels = await generatorLabels(technicianId, candidates);
  const phrase = terms.length > 1 ? new RegExp(escapeRegex(terms.join(" ")), "i") : null;

  const hits: SearchHit[] = candidates.map((doc) => {
    const fields = textFields(doc);
    const matched = new Set<MatchField>();
    let score = 0;
    for (const term of terms) {
      const re = new RegExp(wordPrefixPattern(term), "i");
      let best = 0;
      for (const [field, values] of Object.entries(fields) as [Exclude<MatchField, "generator">, string[]][]) {
        if (values.some((v) => re.test(v))) {
          matched.add(field);
          best = Math.max(best, WEIGHTS[field]);
        }
      }
      if ((generatorsByTerm.get(term) ?? []).some((id) => id.equals(doc.generatorId))) {
        matched.add("generator");
        best = Math.max(best, WEIGHTS.generator);
      }
      score += best;
    }
    if (phrase) {
      for (const field of ["reportedSymptoms", "diagnosis", "workPerformed", "parts"] as const) {
        if (fields[field].some((v) => phrase.test(v))) score += 2;
      }
    }
    return {
      ...toRepair(doc),
      generator: { id: doc.generatorId.toHexString(), label: labels.get(doc.generatorId.toHexString()) ?? "" },
      matchedIn: [...matched],
      score,
    };
  });

  // Best matches first; ties (and filter-only searches) newest first, undated last.
  const time = (h: SearchHit) => h.repairDate?.getTime() ?? -Infinity;
  hits.sort((a, b) => b.score - a.score || time(b) - time(a) || b.createdAt.getTime() - a.createdAt.getTime());
  return { hits, truncated };
}

async function generatorLabels(technicianId: string, docs: RepairDoc[]): Promise<Map<string, string>> {
  const ids = [...new Map(docs.map((d) => [d.generatorId.toHexString(), d.generatorId])).values()];
  if (!ids.length) return new Map();
  const generators = await collections
    .generators()
    .find({ technicianId, _id: { $in: ids } }, { projection: { label: 1 } })
    .toArray();
  return new Map(generators.map((g) => [g._id.toHexString(), g.label]));
}
