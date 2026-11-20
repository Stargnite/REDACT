import { locateQuote } from "./offsets";
import { parseLooseJson } from "./parse";
import { describeType } from "./taxonomy";
import type { Finding } from "./types";

/** Which tier a model run used. */
export type Tier = "on_device" | "cloud";

export interface ModelRun {
  ok: boolean;
  /** The raw text the model returned. Empty when the run failed. */
  raw: string;
  /** The tier we asked for. */
  tier: Tier;
  /** Where the run actually happened. Not always the tier we asked for. */
  source: "on_device" | "in_cloud";
  /** Characters that actually left the device. Zero for every on-device run. */
  charsSent: number;
  error?: string;
}

/**
 * The model tier is injected rather than imported, so the whole scanning
 * pipeline can be exercised without a Firebase project, a network, or a
 * browser. The UI passes the real runner; tests pass a stub.
 */
export type ModelRunner = (text: string, tier: Tier) => Promise<ModelRun>;

const QUOTE_KEYS = ["quote", "text", "value", "snippet", "match", "span"];
const TYPE_KEYS = ["type", "label", "category", "kind", "class"];

export interface ModelFinding {
  type: string;
  quote: string;
}

function firstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Reads findings out of whatever shape the model produced. A small model
 * nests things differently, wraps them, or renames the keys, so this is
 * deliberately permissive.
 */
export function readModelFindings(value: unknown): ModelFinding[] {
  let container: unknown = value;

  if (container && typeof container === "object" && !Array.isArray(container)) {
    const record = container as Record<string, unknown>;
    const nested = record.findings ?? record.detections ?? record.results ?? record.items;
    if (nested !== undefined) container = nested;
  }

  if (!Array.isArray(container)) return [];

  const findings: ModelFinding[] = [];

  for (const item of container) {
    if (typeof item === "string") {
      findings.push({ type: "DETECTED", quote: item.trim() });
      continue;
    }
    if (!item || typeof item !== "object") continue;

    const record = item as Record<string, unknown>;
    const quote = firstString(record, QUOTE_KEYS);
    if (!quote) continue;

    const type = firstString(record, TYPE_KEYS) ?? "DETECTED";
    findings.push({ type: type.toUpperCase().replace(/[^A-Z0-9_]/g, "_"), quote });
  }

  return findings;
}

/**
 * Turns raw model output into findings with resolved offsets.
 *
 * A quote that cannot be found in the source text is dropped. The model
 * paraphrasing, or inventing a secret, must not be able to corrupt the
 * masking step.
 */
export function toFindings(text: string, raw: string): { findings: Finding[]; error?: string } {
  const parsed = parseLooseJson(raw);
  if (!parsed.ok) return { findings: [], error: parsed.error };

  const modelFindings = readModelFindings(parsed.value);
  const findings: Finding[] = [];

  for (const candidate of modelFindings) {
    const span = locateQuote(text, candidate.quote);
    if (!span) continue;

    const description = describeType(candidate.type);

    findings.push({
      type: candidate.type,
      label: description.label,
      severity: description.severity,
      quote: text.slice(span.start, span.end),
      start: span.start,
      end: span.end,
      source: "model",
    });
  }

  return { findings };
}
