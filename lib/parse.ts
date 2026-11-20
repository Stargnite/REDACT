/**
 * Tolerant JSON parsing for model output.
 *
 * A small on-device model will, sooner or later, hand back JSON with a
 * trailing comma, a code fence, or a smart quote. None of those should cost
 * the user a result, so we repair the common damage and try again.
 */

export type LooseParse =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

const BACKSLASH = String.fromCharCode(92);
const NEWLINE = String.fromCharCode(10);

/** Removes a markdown code fence, if the whole response is wrapped in one. */
export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  const withoutOpen = trimmed.slice(3);
  const firstNewline = withoutOpen.indexOf(NEWLINE);
  const body = firstNewline === -1 ? withoutOpen : withoutOpen.slice(firstNewline + 1);
  const closing = body.lastIndexOf("```");
  return (closing === -1 ? body : body.slice(0, closing)).trim();
}

/** Replaces curly quotes with straight ones. */
function normaliseQuotes(input: string): string {
  return input
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

/**
 * Removes trailing commas that sit directly before a closing brace or
 * bracket, ignoring anything inside a string literal.
 */
export function stripTrailingCommas(input: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i);

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === BACKSLASH) {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === ",") {
      const next = input.charAt(i + 1);
      if (next === "}" || next === "]") {
        continue;
      }
    }

    out += ch;
  }

  return out;
}

/**
 * Finds the outermost JSON object or array in a string that may be wrapped in
 * prose. Returns null when there is no candidate at all.
 */
export function extractJsonSlice(raw: string): string | null {
  const objectStart = raw.indexOf("{");
  const arrayStart = raw.indexOf("[");

  let start = -1;
  let endChar = "";
  if (objectStart !== -1 && (arrayStart === -1 || objectStart < arrayStart)) {
    start = objectStart;
    endChar = "}";
  } else if (arrayStart !== -1) {
    start = arrayStart;
    endChar = "]";
  }

  if (start === -1) return null;

  const end = raw.lastIndexOf(endChar);
  if (end === -1 || end < start) return null;

  return raw.slice(start, end + 1);
}

/**
 * Parses model output as JSON, repairing the damage a small model commonly
 * does. Returns the parsed value or a reason it could not be read.
 */
export function parseLooseJson(raw: string): LooseParse {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "The model returned an empty response." };
  }

  const candidates: string[] = [];

  const unfenced = stripCodeFence(trimmed);
  candidates.push(unfenced);

  const sliced = extractJsonSlice(unfenced);
  if (sliced && sliced !== unfenced) candidates.push(sliced);

  for (const candidate of candidates) {
    const direct = tryParse(candidate);
    if (direct.ok) return direct;

    const repaired = stripTrailingCommas(normaliseQuotes(candidate));
    const repairedResult = tryParse(repaired);
    if (repairedResult.ok) return repairedResult;
  }

  return {
    ok: false,
    error: "The model returned something that is not JSON.",
  };
}

function tryParse(candidate: string): LooseParse {
  try {
    const value = JSON.parse(candidate);
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
