import { mergeFindings } from "./offsets";
import { toFindings, type ModelRunner, type Tier } from "./model";
import { findPatterns } from "./patterns";
import type { ScanMode, ScanResult } from "./types";

/**
 * A rough token estimate. The real on-device window is reported by the
 * browser, but it moves between Chrome releases, and we need a number before
 * we have a session. Four characters per token is the usual English rule of
 * thumb and it errs on the side of sending less.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Above this estimate we go straight to the cloud rather than risking an
 * on-device run that will overflow. The budget is deliberately conservative:
 * a text that fits on device is a text we can honestly say never left the
 * machine, and that claim is worth more than saving a round trip.
 */
export const ON_DEVICE_TOKEN_BUDGET = 3000;

export interface ScrubOptions {
  mode?: ScanMode;
  /** Omit it and the scan runs the pattern tier only. */
  runner?: ModelRunner;
}

function chooseTier(text: string, mode: ScanMode): Tier {
  if (mode === "cloud") return "cloud";
  if (mode === "on_device") return "on_device";
  return estimateTokens(text) > ON_DEVICE_TOKEN_BUDGET ? "cloud" : "on_device";
}

/**
 * The whole scan, end to end.
 *
 * The pattern tier always runs. The model tier runs when a runner is
 * supplied. In auto mode an on-device failure escalates to the cloud rather
 * than returning nothing, and the receipt records that it did.
 */
export async function scrub(
  text: string,
  options: ScrubOptions = {}
): Promise<ScanResult> {
  const mode = options.mode ?? "auto";
  const startedAt = Date.now();

  const patternStartedAt = Date.now();
  const patternFindings = findPatterns(text);
  const patternsMs = Date.now() - patternStartedAt;

  const base: ScanResult = {
    findings: patternFindings,
    inferenceSource: "PATTERNS_ONLY",
    escalated: false,
    charCount: text.length,
    charsSent: 0,
    patternCount: patternFindings.length,
    modelCount: 0,
    durations: { patternsMs, modelMs: 0, totalMs: Date.now() - startedAt },
  };

  if (!options.runner || !text.trim()) {
    return base;
  }

  let tier = chooseTier(text, mode);
  const modelStartedAt = Date.now();

  let run = await options.runner(text, tier);

  // An on-device run that fails escalates to the cloud, but only when the
  // user asked for automatic behaviour. A deliberate "on device only" choice
  // is honoured even if it means returning no model findings.
  if (!run.ok && tier === "on_device" && mode === "auto") {
    tier = "cloud";
    run = await options.runner(text, tier);
  }

  const modelMs = Date.now() - modelStartedAt;

  if (!run.ok) {
    return {
      ...base,
      degradedReason: run.error ?? "The model tier failed.",
      durations: { patternsMs, modelMs, totalMs: Date.now() - startedAt },
    };
  }

  const { findings: modelFindings } = toFindings(text, run.raw);
  const findings = mergeFindings([...patternFindings, ...modelFindings]);

  // The badge and the character counter report where the scan actually ran,
  // not where it was aimed. In auto mode a run that ended up in the cloud
  // counts as escalated, whether that happened because the text was too
  // large or because the on-device model was not ready.
  const ranInCloud = run.source === "in_cloud";

  return {
    findings,
    inferenceSource: ranInCloud ? "IN_CLOUD" : "ON_DEVICE",
    escalated: mode === "auto" && ranInCloud,
    charCount: text.length,
    charsSent: run.charsSent,
    patternCount: patternFindings.length,
    modelCount: modelFindings.length,
    durations: { patternsMs, modelMs, totalMs: Date.now() - startedAt },
  };
}
