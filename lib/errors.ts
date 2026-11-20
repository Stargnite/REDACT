/**
 * The model tier fails in a handful of recognisable ways, and the SDK's own
 * message is not one of them. What comes back is a paragraph of prose with a
 * JSON blob welded onto the end - unreadable, and at that length wide enough
 * to break the layout. So the failure is classified and said in a sentence.
 */

export type ModelTierErrorCode =
  | "QUOTA"
  | "APP_CHECK"
  | "NETWORK"
  | "MODEL_UNAVAILABLE"
  | "UNKNOWN";

export interface ModelTierError {
  code: ModelTierErrorCode;
  /** A short mono label, e.g. "QUOTA EXCEEDED". */
  label: string;
  /** One sentence naming the failure. */
  title: string;
  /** What it means for the result the user is looking at. */
  detail: string;
  /** When the failure is expected to clear itself, in plain words. */
  retryHint?: string;
  /** The SDK's own message. Kept for the disclosure, never rendered raw. */
  raw: string;
}

const QUOTA = /quota|resource_exhausted/i;
const APP_CHECK = /app ?check/i;
const MODEL_UNAVAILABLE = /on-device|on device|user activation|no available model|model not (found|available)/i;
const NETWORK = /failed to fetch|networkerror|network request failed|err_network|err_connection|err_internet|load failed/i;

/**
 * The SDK reports the reset window in the quota message, e.g. "Please retry in
 * 15h5m44.61294071s". Only the hours and minutes are worth showing.
 */
function parseRetryHint(raw: string): string | undefined {
  const match = raw.match(/retry in (\d+)h(\d+)m/i);
  if (!match) return undefined;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 0) {
    return `The quota resets in about ${hours} hour${hours === 1 ? "" : "s"}.`;
  }
  return `The quota resets in about ${minutes} minutes.`;
}

export function explainModelError(raw: string): ModelTierError {
  const base = { raw };

  if (QUOTA.test(raw)) {
    return {
      ...base,
      code: "QUOTA",
      label: "QUOTA EXCEEDED",
      title: "The cloud model's free tier is spent for today.",
      detail:
        "Firebase allows 20 cloud requests a day. The findings below come from the pattern rules alone - a person's name, their employer, an address or a free-form secret would not have been caught, so treat this as a partial scrub.",
      retryHint: parseRetryHint(raw),
    };
  }

  if (APP_CHECK.test(raw)) {
    return {
      ...base,
      code: "APP_CHECK",
      label: "APP CHECK REJECTED",
      title: "The browser could not prove it was allowed to call the model.",
      detail: "Reload the page and scan again.",
    };
  }

  if (MODEL_UNAVAILABLE.test(raw)) {
    return {
      ...base,
      code: "MODEL_UNAVAILABLE",
      label: "ON-DEVICE MODEL UNAVAILABLE",
      title: "Chrome has not finished getting the on-device model ready.",
      detail: "The scan fell back to the cloud model instead.",
    };
  }

  if (NETWORK.test(raw)) {
    return {
      ...base,
      code: "NETWORK",
      label: "NO CONNECTION",
      title: "The request never reached the model.",
      detail: "The browser could not reach Firebase. Check the connection and scan again.",
    };
  }

  return {
    ...base,
    code: "UNKNOWN",
    label: "MODEL TIER FAILED",
    title: "The model tier did not finish.",
    detail:
      "The findings below come from the pattern rules alone, so treat this as a partial scrub.",
  };
}
