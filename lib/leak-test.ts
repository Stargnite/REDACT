import { findPatterns } from "./patterns";
import type { ProgressReporter } from "./progress";
import { applyOutput, distinctiveTokens } from "./rewrite";
import { scrub, chooseTier } from "./scrub";
import type { LeakRunner, ModelRunner, Tier } from "./model";
import { parseLooseJson } from "./parse";
import type { Finding, ScanContext, ScanMode, ScanResult } from "./types";

/**
 * The leak test.
 *
 * A redaction that leaves a trace is not a redaction. This module asks two
 * questions of the clean copy:
 *
 * 1. Programmatically: does anything the tool meant to remove still appear in
 *    the copy, or come back in a new form?
 * 2. From the model: what could a reader still work out from the copy alone?
 *
 * The first question needs no model and always runs. The second needs one, and
 * its answers are only accepted when they quote the clean copy, so the report
 * can never be the thing that leaks.
 */

export type LeakKind = "residual_token" | "pattern_reintroduced" | "inference";

export type LeakSeverity = "high" | "medium" | "low";

export interface Leak {
  kind: LeakKind;
  severity: LeakSeverity;
  /** A description that never contains the secret itself. */
  detail: string;
  /** The part of the clean copy that carries the leak, when there is one. */
  citation?: string;
  /** The evidence, shown only behind a toggle. */
  evidence?: string;
}

export type LeakVerdict = "CLEAN" | "TRACEABLE" | "LEAKING";

const MASK_TOKEN = /\[REDACTED:[A-Z0-9_]+\]/g;

/** Removes the mask tokens, so a rule cannot fire on the tool's own output. */
export function stripMaskTokens(text: string): string {
  return text.replace(MASK_TOKEN, " ");
}

/**
 * The original text with every redacted span taken out. Whatever is in here
 * survived on purpose, so it cannot be a leak.
 */
export function keptText(text: string, findings: Finding[]): string {
  const ordered = findings
    .filter((finding) => finding.decision === "redact")
    .sort((a, b) => a.start - b.start);

  let out = "";
  let cursor = 0;

  for (const finding of ordered) {
    if (finding.start < cursor) continue;
    out += text.slice(cursor, finding.start);
    cursor = finding.end;
  }

  return out + text.slice(cursor);
}

/**
 * The parts of a redacted span that must not survive anywhere in the copy.
 *
 * The distinctive token of the span is the head of the name, or a long number.
 * If it appears in the copy and it did not appear in the text that was left
 * alone, then it came back through a rewrite.
 */
export function residualTokenLeaks(
  text: string,
  findings: Finding[],
  cleanCopy: string
): Leak[] {
  const kept = keptText(text, findings).toLowerCase();
  const copy = cleanCopy.toLowerCase();
  const leaks: Leak[] = [];

  for (const finding of findings) {
    if (finding.decision !== "redact") continue;

    for (const token of distinctiveTokens(finding.quote)) {
      const lower = token.toLowerCase();
      if (!copy.includes(lower)) continue;
      if (kept.includes(lower)) continue;

      leaks.push({
        kind: "residual_token",
        severity: "high",
        detail: `A distinctive part of a redacted ${finding.label.toLowerCase()} is still in the clean copy.`,
        evidence: token,
      });
    }
  }

  return leaks;
}

/**
 * Secrets that came back in a new form. A rewrite that produces an email
 * address, or a key that matches a credential rule, is a leak whatever the
 * model meant by it.
 */
export function reintroducedPatternLeaks(cleanCopy: string): Leak[] {
  const bare = stripMaskTokens(cleanCopy);

  return findPatterns(bare).map((finding) => ({
    kind: "pattern_reintroduced" as const,
    severity:
      finding.severity === "critical"
        ? ("high" as const)
        : finding.severity === "high"
          ? ("medium" as const)
          : ("low" as const),
    detail: `The clean copy still matches the ${finding.label.toLowerCase()} rule.`,
    evidence: finding.quote,
  }));
}

export interface LeakClaim {
  claim: string;
  quote: string;
}

const CLAIM_KEYS = ["claim", "finding", "observation", "inference", "detail"];
const QUOTE_KEYS = ["quote", "evidence", "excerpt", "phrase", "snippet"];
const CLAIM_LIST_KEYS = ["claims", "findings", "leaks", "results", "items"];

function firstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Reads the claims out of whatever shape the model produced. */
export function readLeakClaims(raw: string): LeakClaim[] {
  const parsed = parseLooseJson(raw);
  if (!parsed.ok) return [];

  let container: unknown = parsed.value;

  if (container && typeof container === "object" && !Array.isArray(container)) {
    const record = container as Record<string, unknown>;
    for (const key of CLAIM_LIST_KEYS) {
      if (record[key] !== undefined) {
        container = record[key];
        break;
      }
    }
  }

  if (!Array.isArray(container)) return [];

  const claims: LeakClaim[] = [];

  for (const item of container) {
    if (typeof item === "string") {
      if (item.trim()) claims.push({ claim: item.trim(), quote: "" });
      continue;
    }
    if (!item || typeof item !== "object") continue;

    const record = item as Record<string, unknown>;
    const claim = firstString(record, CLAIM_KEYS);
    if (!claim) continue;

    claims.push({ claim, quote: firstString(record, QUOTE_KEYS) ?? "" });
  }

  return claims;
}

const MAX_CLAIMS = 8;

/**
 * Accepts only the claims that can be checked.
 *
 * A claim survives when it quotes the clean copy, because then a reader can
 * go and look. A claim that quotes nothing is a guess, and a guess is not
 * evidence. A claim that carries a distinctive token of something that was
 * redacted is dropped outright, because printing it would leak the thing the
 * report is about.
 */
export function groundClaims(
  claims: LeakClaim[],
  cleanCopy: string,
  findings: Finding[]
): Leak[] {
  const copy = cleanCopy.toLowerCase();
  const secrets = findings
    .filter((finding) => finding.decision === "redact")
    .flatMap((finding) => distinctiveTokens(finding.quote))
    .map((token) => token.toLowerCase());

  const leaks: Leak[] = [];

  for (const claim of claims) {
    if (leaks.length >= MAX_CLAIMS) break;

    const quote = claim.quote.trim();
    if (quote.length < 4) continue;
    if (!copy.includes(quote.toLowerCase())) continue;

    const lowerClaim = claim.claim.toLowerCase();
    if (secrets.some((secret) => lowerClaim.includes(secret))) continue;

    leaks.push({
      kind: "inference",
      severity: "medium",
      detail: claim.claim,
      citation: quote,
    });
  }

  return leaks;
}

const WEIGHTS: Record<LeakSeverity, number> = {
  high: 40,
  medium: 20,
  low: 8,
};

/** A score out of a hundred, and the verdict that goes with it. */
export function scoreLeaks(leaks: Leak[]): { verdict: LeakVerdict; score: number } {
  const score = Math.min(
    100,
    leaks.reduce((total, leak) => total + WEIGHTS[leak.severity], 0)
  );

  const verdict: LeakVerdict =
    leaks.length === 0
      ? "CLEAN"
      : leaks.some((leak) => leak.severity === "high")
        ? "LEAKING"
        : "TRACEABLE";

  return { verdict, score };
}

export interface LeakProbe {
  tier: Tier;
  source: "on_device" | "in_cloud";
  charsSent: number;
  error?: string;
}

export interface LeakTestResult {
  scan: ScanResult;
  cleanCopy: string;
  leaks: Leak[];
  verdict: LeakVerdict;
  score: number;
  probe?: LeakProbe;
}

export interface LeakTestOptions {
  context: ScanContext;
  mode?: ScanMode;
  /** The scan runner. Omit it and the scan runs the pattern tier only. */
  runner?: ModelRunner;
  /** Reports each stage of the scan as it starts and finishes. */
  onProgress?: ProgressReporter;
}

/**
 * Runs the scrub and the local checks.
 *
 * No model is asked anything beyond the scan itself: the two programmatic
 * checks are arithmetic over the copy and the findings, so they cost nothing
 * and finish the moment the scan does.
 */
export async function runLeakTest(
  text: string,
  options: LeakTestOptions
): Promise<LeakTestResult> {
  const mode = options.mode ?? "auto";
  const context = options.context;

  const scan = await scrub(text, {
    mode,
    runner: options.runner,
    context,
    onProgress: options.onProgress,
  });
  const cleanCopy = applyOutput(text, scan.findings, context.outputForm);

  const leaks: Leak[] = [
    ...residualTokenLeaks(text, scan.findings, cleanCopy),
    ...reintroducedPatternLeaks(cleanCopy),
  ];

  const { verdict, score } = scoreLeaks(leaks);

  return { scan, cleanCopy, leaks, verdict, score };
}

export interface LeakProbeOptions {
  mode?: ScanMode;
  /** The probe runner. Omit it and nothing happens. */
  leakRunner?: LeakRunner;
}

/**
 * Asks a model to work the redaction backwards.
 *
 * This is a second model call on top of the scan, so it is never run unless
 * the user asks for it. It is also the one thing on the page that can cost
 * cloud quota, which is another reason to leave it to a button.
 *
 * The probe is only ever shown the clean copy. It never sees a secret, not
 * even in the cloud, so the report cannot leak the thing it is about and the
 * cloud probe carries nothing but the text the user was going to send anyway.
 */
export async function probeLeakTest(
  result: LeakTestResult,
  options: LeakProbeOptions
): Promise<LeakTestResult> {
  const mode = options.mode ?? "auto";
  const { scan, cleanCopy } = result;

  if (!options.leakRunner || !cleanCopy.trim()) return result;

  const removedTypes = Array.from(
    new Set(
      scan.findings
        .filter((finding) => finding.decision === "redact")
        .map((finding) => finding.type)
    )
  );

  let tier = chooseTier(cleanCopy, mode);
  let run = await options.leakRunner(cleanCopy, removedTypes, tier);

  if (!run.ok && tier === "on_device" && mode === "auto") {
    tier = "cloud";
    run = await options.leakRunner(cleanCopy, removedTypes, tier);
  }

  const probe: LeakProbe = {
    tier,
    source: run.source,
    charsSent: run.charsSent,
    error: run.ok ? undefined : run.error,
  };

  const inference = run.ok
    ? groundClaims(readLeakClaims(run.raw), cleanCopy, scan.findings)
    : [];

  const leaks = [...result.leaks, ...inference];
  const { verdict, score } = scoreLeaks(leaks);

  return { ...result, leaks, verdict, score, probe };
}

