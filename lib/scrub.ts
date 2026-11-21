import { mergeFindings, resolveRetentions } from "./offsets";
import { toFindings, type ModelRunner, type Tier } from "./model";
import { findLabelValues } from "./labels";
import { findPatterns } from "./patterns";
import type { ProgressReporter } from "./progress";
import { DEFAULT_CONTEXT } from "./purpose";
import { describeType } from "./taxonomy";
import type { Finding, ScanContext, ScanMode, ScanResult } from "./types";

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
  /** What the text is for, and how the clean copy should read. */
  context?: ScanContext;
  /** Reports each stage as it starts and finishes. */
  onProgress?: ProgressReporter;
}

export function chooseTier(text: string, mode: ScanMode): Tier {
  if (mode === "cloud") return "cloud";
  if (mode === "on_device") return "on_device";
  return estimateTokens(text) > ON_DEVICE_TOKEN_BUDGET ? "cloud" : "on_device";
}

/**
 * The values written under a field label.
 *
 * A form says what its fields hold, so the field is sensitive whatever a
 * small model happened to notice that day. And the on-device model is small:
 * asked to read a form, it will sometimes report the name and the email and
 * leave the address alone. Coverage that depends on the model's recall is
 * coverage that comes and goes, so the fields a form is built from are covered
 * here instead.
 *
 * These are pattern-tier findings, so a purpose that says a field is needed
 * can still keep it.
 */
function labelFindings(text: string): Finding[] {
  return findLabelValues(text).map((value) => {
    const description = describeType(value.type);

    return {
      type: value.type,
      label: description.label,
      severity: description.severity,
      quote: value.quote,
      start: value.start,
      end: value.end,
      source: "pattern",
      decision: "redact",
    };
  });
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
  const context = options.context ?? DEFAULT_CONTEXT;
  const startedAt = Date.now();

  const patternStartedAt = Date.now();
  options.onProgress?.({
    id: "rules",
    label: "THE RULES",
    status: "running",
    fraction: null,
  });
  const labelTier = labelFindings(text);
  const patternFindings = [...labelTier, ...findPatterns(text)];
  const patternsMs = Date.now() - patternStartedAt;
  options.onProgress?.({
    id: "rules",
    label: "THE RULES",
    status: "done",
    fraction: 1,
  });

  const base: ScanResult = {
    findings: patternFindings,
    inferenceSource: "PATTERNS_ONLY",
    escalated: false,
    charCount: text.length,
    charsSent: 0,
    patternCount: patternFindings.length,
    modelCount: 0,
    retainedCount: 0,
    context,
    durations: { patternsMs, modelMs: 0, totalMs: Date.now() - startedAt },
  };

  if (!options.runner || !text.trim()) {
    return base;
  }

  let tier = chooseTier(text, mode);
  const modelStartedAt = Date.now();

  const tierLabel = (which: Tier) =>
    which === "cloud" ? "THE CLOUD MODEL" : "THE ON-DEVICE MODEL";

  options.onProgress?.({
    id: "model",
    label: tierLabel(tier),
    status: "running",
    fraction: null,
  });

  let run = await options.runner(text, tier, context);

  // An on-device run that fails escalates to the cloud, but only when the
  // user asked for automatic behaviour. A deliberate "on device only" choice
  // is honoured even if it means returning no model findings.
  if (!run.ok && tier === "on_device" && mode === "auto") {
    tier = "cloud";
    options.onProgress?.({
      id: "model",
      label: tierLabel(tier),
      status: "running",
      fraction: null,
    });
    run = await options.runner(text, tier, context);
  }

  const modelMs = Date.now() - modelStartedAt;

  options.onProgress?.({
    id: "model",
    label: tierLabel(tier),
    status: "done",
    fraction: 1,
  });

  if (!run.ok) {
    return {
      ...base,
      degradedReason: run.error ?? "The model tier failed.",
      durations: { patternsMs, modelMs, totalMs: Date.now() - startedAt },
    };
  }

  const { findings: modelFindings, error: parseError, dropped } = toFindings(
    text,
    run.raw,
    context
  );

  // A field label knows what its own field holds, so it settles the type of
  // the span it covers. A model finding about the same words is dropped: it
  // says nothing the label does not already say, and it says it less well.
  const beyondLabels = modelFindings.filter(
    (finding) =>
      !labelTier.some(
        (label) =>
          finding.start >= label.start && finding.end <= label.end
      )
  );

  const resolved = resolveRetentions([...patternFindings, ...beyondLabels]);
  const findings = mergeFindings(resolved);
  const retainedCount = findings.filter(
    (finding) => finding.decision === "retain"
  ).length;

  // A model answer that cannot be read means the model tier did not finish.
  // A span that cannot be placed means something was missed. They are
  // reported apart: the first is a broken run, the second is a gap in the
  // cover, and the user needs to be able to tell them apart.
  const degradedReason = parseError;

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
    patternCount: findings.filter((finding) => finding.source === "pattern").length,
    modelCount: findings.filter((finding) => finding.source === "model").length,
    retainedCount,
    context,
    degradedReason,
    unmatchedCount: dropped,
    durations: { patternsMs, modelMs, totalMs: Date.now() - startedAt },
  };
}
