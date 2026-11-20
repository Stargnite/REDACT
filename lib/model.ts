import { labelType, valueAfterLabel } from "./labels";
import { locateQuote } from "./offsets";
import { findJsonObjects, parseLooseJson, stripCodeFence } from "./parse";
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

/**
 * The leak probe.
 *
 * It is given the clean copy and the kinds of thing that were removed, and
 * nothing else. It never receives the original, so it cannot quote a secret
 * and the report cannot become the leak.
 */
export type LeakRunner = (
  cleanCopy: string,
  removedTypes: string[],
  tier: Tier
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
    const finding = findingFromRecord(record);
    if (!finding) continue;
    findings.push(finding);
  }

  return findings;
}

const MAX_REASON_LENGTH = 160;

/**
 * The message used when the model answered, but the answer was not valid JSON
 * and only parts of it could be read.
 */
export const MALFORMED_ANSWER =
  "The model's answer was malformed. Only the findings that could be read out of it were used.";

/**
 * Reads the fields out of an object that is not valid JSON.
 *
 * Used on the pieces of a malformed answer: the field names and values are
 * still readable as text even when the braces around them are not.
 */
function readFieldsByPattern(object: string): Record<string, unknown> | null {
  const record: Record<string, unknown> = {};
  const pattern = /"([A-Za-z_][A-Za-z0-9_]*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

  let match: RegExpExecArray | null;
  let found = false;

  while ((match = pattern.exec(object)) !== null) {
    found = true;
    if (match[1] in record) continue;
    try {
      record[match[1]] = JSON.parse(`"${match[2]}"`);
    } catch {
      record[match[1]] = match[2];
    }
  }

  return found ? record : null;
}

function findingFromRecord(
  record: Record<string, unknown>
): ModelFinding | null {
  const quote = firstString(record, QUOTE_KEYS);
  if (!quote) return null;

  const type = firstString(record, TYPE_KEYS) ?? "DETECTED";

  return {
    type: type.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
    quote,
    decision: firstString(record, DECISION_KEYS) ?? undefined,
    replacement: firstString(record, REPLACEMENT_KEYS) ?? undefined,
    reason: firstString(record, REASON_KEYS) ?? undefined,
  };
}

/**
 * Reads findings out of the objects inside a malformed answer.
 *
 * Every object is checked on its own, so a brace in the wrong place costs the
 * one object it breaks and not the whole answer. A finding still has to pass
 * the same check as any other: its quote has to be found in the source text
 * before it is allowed to cover anything.
 */
export function readFindingsFromObjects(objects: string[]): ModelFinding[] {
  const findings: ModelFinding[] = [];

  for (const object of objects) {
    let record: Record<string, unknown> | null = null;

    try {
      const value = JSON.parse(object);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        record = value as Record<string, unknown>;
      }
    } catch {
      record = readFieldsByPattern(object);
    }

    if (!record) continue;

    const finding = findingFromRecord(record);
    if (!finding) continue;

    findings.push(finding);
  }

  return findings;
}

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
 * The number of dropped quotes is returned as well. A quote that cannot be
 * placed is a span that is not covered, and a scan that quietly loses one is
 * a scan the user cannot trust, so the caller is told.
 *
 * The rewrite is checked here rather than later, so a rewrite that still
 * carries the original name never reaches the clean copy.
 */
export function toFindings(
  text: string,
  raw: string,
  context: ScanContext = DEFAULT_CONTEXT
): { findings: Finding[]; error?: string; dropped: number } {
  const parsed = parseLooseJson(raw);

  const modelFindings: ModelFinding[] = [];
  let error: string | undefined;

  if (parsed.ok) {
    modelFindings.push(...readModelFindings(parsed.value));
  } else {
    error = parsed.error;
  }

  // Whether or not the answer parsed, the objects inside it are read on their
  // own. A well-formed answer gives the same findings twice, so the ones
  // already in hand are left alone.
  const salvaged = readFindingsFromObjects(findJsonObjects(stripCodeFence(raw)));
  const seen = new Set(modelFindings.map((f) => `${f.type}|${f.quote}`));

  for (const finding of salvaged) {
    const key = `${finding.type}|${finding.quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    modelFindings.push(finding);
  }

  if (!parsed.ok && modelFindings.length > 0) {
    error = MALFORMED_ANSWER;
  }

  const findings: Finding[] = [];
  let dropped = 0;

  for (const candidate of modelFindings) {
    const located = locateQuote(text, candidate.quote);
    if (!located) {
      dropped += 1;
      continue;
    }

    // A finding on a field label is a pointer to the value under it, not the
    // label itself. Following the pointer also covers the value when the
    // model reported the label and missed the value.
    const label = labelType(candidate.quote);
    const span = label ? valueAfterLabel(text, located.start, located.end) : located;

    // A label with no value under it is nothing to cover.
    if (!span) continue;

    const type = label ?? candidate.type;

    const description = describeType(type);
    const quote = text.slice(span.start, span.end);
    const decision = resolveDecision(type, candidate, context);

    const replacement =
      decision === "redact" && context.outputForm === "rewritten"
        ? safeReplacement(type, quote, candidate.replacement)
        : undefined;

    findings.push({
      type,
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

  return { findings, error, dropped };
}
