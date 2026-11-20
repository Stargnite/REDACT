/**
 * The vocabulary of a scan. Everything the UI renders is one of these shapes,
 * and nothing here knows about React or Firebase.
 */

export type Severity = "critical" | "high" | "low";

/** Which tier produced the finding. */
export type FindingSource = "pattern" | "model";

/**
 * What to do with a span. Only the model tier can retain one, and only when
 * the purpose says the span is needed for it.
 */
export type FindingDecision = "redact" | "retain";

/**
 * How the clean copy is written.
 *
 * `rewritten` replaces a span with a generic phrase that keeps the sentence
 * readable. `token` replaces it with a label that names the type. Credentials
 * are always tokenised, in both forms: a secret has no safe shorter version.
 */
export type OutputForm = "rewritten" | "token";

/** What the text is for, which decides what counts as sensitive. */
export type Purpose =
  | "general"
  | "job_application"
  | "support_ticket"
  | "medical_note"
  | "legal_contract"
  | "public_post"
  | "custom";

/** What kind of input the scan started from. */
export type InputKind = "text" | "image" | "pdf";

export interface ScanContext {
  purpose: Purpose;
  /** The user's own rule, when the purpose is `custom`. */
  purposeNote?: string;
  outputForm: OutputForm;
}

/**
 * A box in an image, in the normalised 0-1000 coordinates the model returns.
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  /** What to do with the span. Pattern findings are always `redact`. */
  decision: FindingDecision;
  /** Why the model flagged it, in a few words. Absent when it did not say. */
  reason?: string;
  /**
   * A generic rewrite of the span, for the `rewritten` output form. Only
   * present when it passed the leak check in `rewrite.ts`.
   */
  replacement?: string;
  /** Where the span sits in the image, when the input was an image. */
  bbox?: BoundingBox;
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
  /** Findings the purpose says are safe to keep. They stay in the clean copy. */
  retainedCount: number;
  /** The context the scan ran under, echoed back for the receipt. */
  context: ScanContext;
  durations: ScanDurations;
  /** Populated when the model tier failed and we degraded to patterns only. */
  degradedReason?: string;
}

/** The user's choice about which tier to use. */
export type ScanMode = "auto" | "on_device" | "cloud";
