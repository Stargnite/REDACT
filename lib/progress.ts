/**
 * How a scrub says what it is doing.
 *
 * A scan on the device can take a minute and a half, and a picture has to be
 * read before it can be scanned at all. A button that sits there saying
 * "Scanning" tells the user nothing, and a slow machine and a broken one look
 * exactly the same. So every stage of the pipeline reports when it starts and
 * when it finishes.
 */

export type ProgressStatus = "pending" | "running" | "done";

export interface ProgressStep {
  /** Which stage this is, e.g. "rules" or "model". */
  id: string;
  /** What to tell the user. */
  label: string;
  status: ProgressStatus;
  /**
   * How far along the stage is, from 0 to 1, when the stage can say.
   *
   * Null when it cannot. A model call is one opaque request, so there is
   * nothing true to report about it, and a bar that moved on its own would be
   * a lie about work that is not happening.
   */
  fraction: number | null;
}

export type ProgressReporter = (step: ProgressStep) => void;

/** The stages a text scrub goes through. */
export const TEXT_STEPS: ProgressStep[] = [
  { id: "rules", label: "THE RULES", status: "pending", fraction: null },
  { id: "model", label: "THE ON-DEVICE MODEL", status: "pending", fraction: null },
];

/** The stages a picture scrub goes through. */
export const PICTURE_STEPS: ProgressStep[] = [
  { id: "read", label: "READING THE PICTURE", status: "pending", fraction: null },
  { id: "rules", label: "THE RULES", status: "pending", fraction: null },
  { id: "model", label: "THE ON-DEVICE MODEL", status: "pending", fraction: null },
  { id: "cover", label: "COVERING THE WORDS", status: "pending", fraction: null },
];

/**
 * Folds a report into the list of stages.
 *
 * A stage that has not been reported yet is added, so a pipeline that only
 * reports the stages it reached still reads as a list.
 */
export function applyStep(
  steps: ProgressStep[],
  step: ProgressStep
): ProgressStep[] {
  const index = steps.findIndex((existing) => existing.id === step.id);

  if (index === -1) return [...steps, step];

  const next = [...steps];
  next[index] = step;
  return next;
}
