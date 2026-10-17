import "server-only";
import type { ObjectId } from "mongodb";
import type { ExtractionFlag } from "@/lib/extraction";
import type { Engine, FieldKey, FieldSource } from "@/lib/extraction-merge";
import type { FuelType } from "@/lib/schemas/generator";
import type { RepairFieldsInput } from "@/lib/schemas/repair";
import { getDb } from "../db";

// `technicianId` is the auth library's user id (a string). Every query in the
// data-access layer filters on it; nothing outside `server/data` may query
// these collections directly.

export type CustomerDoc = {
  _id: ObjectId;
  technicianId: string;
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
  searchKeys: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type GeneratorDoc = {
  _id: ObjectId;
  technicianId: string;
  customerId: ObjectId;
  label: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  capacityKva: number | null;
  fuelType: FuelType | null;
  location: string | null;
  searchKeys: string[];
  lastRepairAt: Date | null;
  /** Absent on generators created before service reminders existed. */
  serviceIntervalMonths?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

/** One accepted voice-note upload, kept for a day to rate-limit the shared AI server. */
export type VoiceUploadDoc = { _id: ObjectId; technicianId: string; at: Date };

export type RepairPart = { name: string; quantity: number | null; costKobo: number | null };

/**
 * Where a record came from. The original transcript / typed notes are never
 * overwritten; a technician's correction is kept separately in `editedText`.
 */
export type RepairSource =
  | { kind: "manual" }
  | {
      kind: "voice";
      transcriptStatus: "pending" | "done" | "failed";
      transcript: string | null;
      transcriptionError?: string;
      transcriptionModel?: string;
      audioDurationSec?: number;
      transcriptionMs?: number;
      editedText?: string;
    }
  | { kind: "text"; typedText: string; editedText?: string };

/** Unverified model output. Never copied into the record without technician confirmation. */
export type AiSuggestion =
  | { status: "running"; promptVersion: string; startedAt: Date }
  | {
      status: "done";
      fields: RepairFieldsInput;
      flags: ExtractionFlag[];
      /** Which method filled each field (absent on records from before rules existed). */
      sources?: Partial<Record<FieldKey, FieldSource>>;
      engine?: Engine;
      /** Set when the AI was attempted but failed, so the rules filled the form alone. */
      aiError?: string;
      model: string;
      promptVersion: string;
      processingMs: number;
      createdAt: Date;
    }
  | { status: "failed"; error: string; promptVersion: string; createdAt: Date };

export type RepairDoc = {
  _id: ObjectId;
  technicianId: string;
  generatorId: ObjectId;
  customerId: ObjectId;
  status: "draft" | "confirmed";
  repairDate: Date | null;
  reportedSymptoms: string | null;
  diagnosis: string | null;
  workPerformed: string | null;
  partsReplaced: RepairPart[];
  totalCost: { amountKobo: number; currency: "NGN" } | null;
  technicianNotes: string | null;
  source: RepairSource;
  aiSuggestion?: AiSuggestion;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const collections = {
  customers: () => getDb().collection<CustomerDoc>("customers"),
  generators: () => getDb().collection<GeneratorDoc>("generators"),
  repairs: () => getDb().collection<RepairDoc>("repairs"),
  voiceUploads: () => getDb().collection<VoiceUploadDoc>("voiceUploads"),
};
