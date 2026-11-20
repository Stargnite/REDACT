import { locateQuote } from "./offsets";
import { parseLooseJson } from "./parse";
import { allowsRetention, DEFAULT_CONTEXT } from "./purpose";
import { isCredentialType, safeReplacement } from "./rewrite";
import { describeType } from "./taxonomy";
import type { Finding, FindingDecision, ScanContext } from "./types";

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
 *
 * The runner is given the scan context because the prompt it sends depends on
 * the purpose and on the output form.
 */
export type ModelRunner = (
  text: string,
  tier: Tier,
  context: ScanContext
) => Promise<ModelRun>;

const QUOTE_KEYS = ["quote", "text", "value", "snippet", "match", "span"];
const TYPE_KEYS = ["type", "label", "category", "kind", "class"];
const DECISION_KEYS = ["decision", "action", "action_type", "verdict"];
const REPLACEMENT_KEYS = [
  "replacement",
  "rewrite",
  "rewritten",
  "generic",
  "generic_version",
  "generalized",
  "generalised",
  "replacement_text",
  "safe_value",
];
const REASON_KEYS = ["reason", "why", "explanation", "rationale", "justification", "note"];

export interface ModelFinding {
  type: string;
  quote: string;
  decision?: string;
  replacement?: string;
  reason?: string;
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
    const decision = firstString(record, DECISION_KEYS);
    const replacement = firstString(record, REPLACEMENT_KEYS);
    const reason = firstString(record, REASON_KEYS);

    findings.push({
      type: type.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
      quote,
      decision: decision ?? undefined,
      replacement: replacement ?? undefined,
      reason: reason ?? undefined,
    });
  }

  return findings;
}

const MAX_REASON_LENGTH = 160;

/**
 * Works out what to do with a span the model reported.
 *
 * The model can retain a span, but only two ways: the purpose has to allow
 * retention, and the span cannot be a credential. A credential is never
 * retained, no matter what the purpose or the model says, because a purpose
 * is a hint and a secret is not.
 */
export function resolveDecision(
  type: string,
  candidate: ModelFinding,
  context: ScanContext
): FindingDecision {
  if (!allowsRetention(context)) return "redact";
  if (isCredentialType(type)) return "redact";
  if (candidate.decision?.toLowerCase().replace(/[^a-z]/g, "") === "retain") {
    return "retain";
  }
  return "redact";
}

/**
 * Turns raw model output into findings with resolved offsets.
 *
 * A quote that cannot be found in the source text is dropped. The model
 * paraphrasing, or inventing a secret, must not be able to corrupt the
 * masking step.
 *
 * The rewrite is checked here rather than later, so a rewrite that still
 * carries the original name never reaches the clean copy.
 */
export function toFindings(
  text: string,
  raw: string,
  context: ScanContext = DEFAULT_CONTEXT
): { findings: Finding[]; error?: string } {
  const parsed = parseLooseJson(raw);
  if (!parsed.ok) return { findings: [], error: parsed.error };

  const modelFindings = readModelFindings(parsed.value);
  const findings: Finding[] = [];

  for (const candidate of modelFindings) {
    const span = locateQuote(text, candidate.quote);
    if (!span) continue;

    const description = describeType(candidate.type);
    const quote = text.slice(span.start, span.end);
    const decision = resolveDecision(candidate.type, candidate, context);

    const replacement =
      decision === "redact" && context.outputForm === "rewritten"
        ? safeReplacement(candidate.type, quote, candidate.replacement)
        : undefined;

    findings.push({
      type: candidate.type,
      label: description.label,
      severity: description.severity,
      quote,
      start: span.start,
      end: span.end,
      source: "model",
      decision,
      reason: candidate.reason?.slice(0, MAX_REASON_LENGTH),
      replacement,
    });
  }

  return { findings };
}
