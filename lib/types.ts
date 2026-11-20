/**
 * The vocabulary of a scan. Everything the UI renders is one of these shapes,
 * and nothing here knows about React or Firebase.
 */

export type Severity = "critical" | "high" | "low";

/** Which tier produced the finding. */
export type FindingSource = "pattern" | "model";

export interface Finding {
  /** Stable machine code, e.g. "AWS_ACCESS_KEY". Doubles as the mask token. */
  type: string;
  /** Human label for the mono line next to the quote. */
  label: string;
  severity: Severity;
  /** The exact substring of the source text that was detected. */
  quote: string;
  /** Character offsets into the source text. Always resolved against the source. */
  start: number;
  end: number;
  source: FindingSource;
}

/** Where the model tier ran. PATTERNS_ONLY means no model tier ran at all. */
export type InferenceSource = "ON_DEVICE" | "IN_CLOUD" | "PATTERNS_ONLY";

export interface ScanDurations {
  patternsMs: number;
  modelMs: number;
  totalMs: number;
}

export interface ScanResult {
  findings: Finding[];
  inferenceSource: InferenceSource;
  /** True when the input was too large for the on-device window and went to the cloud. */
  escalated: boolean;
  /** Characters of input. */
  charCount: number;
  /** Characters actually sent off-device. Zero for every on-device run. */
  charsSent: number;
  patternCount: number;
  modelCount: number;
  durations: ScanDurations;
  /** Populated when the model tier failed and we degraded to patterns only. */
  degradedReason?: string;
}

/** The user's choice about which tier to use. */
export type ScanMode = "auto" | "on_device" | "cloud";
