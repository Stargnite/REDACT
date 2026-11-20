/**
 * The probe prompt.
 *
 * The probe is an adversary. It is given the clean copy and the list of kinds
 * of thing that were taken out, and it is asked what a reader could still
 * work out from the copy alone.
 *
 * It never sees the original, so it cannot quote a secret and the report can
 * never be the thing that leaks. The price of that is that the probe can only
 * point at context, not at a value, and the report says so.
 */

const BASE_RULES = `Rules:
1. Report only what the copy itself gives away. Do not use outside knowledge and do not speculate about what the missing value might be.
2. Every claim must quote an EXACT span copied verbatim from the copy. If you cannot point at the words that cause the problem, there is no claim.
3. Describe what a reader could narrow down, never a guessed value. "The city is named, so the firm is identifiable to someone local" is a claim. "The name was probably Northwind" is not.
4. Do not report the mask tokens themselves. A placeholder is the tool working, not a leak.
5. Report at most 5 claims, strongest first.
6. If the copy gives nothing away, return an empty list. An empty result is a good result.`;

export const LEAK_OUTPUT_SHAPE =
  '{"claims": [{"claim": "<what a reader could still work out>", "quote": "<exact text copied from the copy>"}]}';

/**
 * The full instruction for one probe.
 *
 * It does not mention what was removed. The list of kinds changes from scan to
 * scan, and the on-device session fixes its system instruction for good, so
 * the varying part travels in the user turn instead.
 */
export function leakInstruction(): string {
  return `You are an adversary reviewing a redacted copy of a message. Some sensitive information was removed from the original before you saw it. Your job is to work out what a reader of this copy could still learn or narrow down.

${BASE_RULES}`;
}

/**
 * The user turn: the list of kinds that were taken out, and the copy itself.
 *
 * Only the copy is quoted. The original never appears here, in either tier.
 */
export function leakUserMessage(
  cleanCopy: string,
  removedTypes: string[]
): string {
  const kinds =
    removedTypes.length > 0
      ? removedTypes.join(", ")
      : "nothing was removed, but check anyway";

  return `Kinds of information that were removed:
${kinds}

The redacted copy:
"""
${cleanCopy}
"""`;
}

/**
 * The JSON shape the probe has to answer with.
 *
 * Small models wrap things differently, so the reader is permissive about
 * the shape. It is not permissive about the quote: a claim with no quote in
 * the copy is thrown away.
 */
export function leakSchemaHint(): string {
  return `Return ONLY JSON, with this exact shape and nothing else:
${LEAK_OUTPUT_SHAPE}`;
}

/** The whole prompt, for whichever tier is running. */
export function leakPrompt(): string {
  return `${leakInstruction()}\n\n${leakSchemaHint()}`;
}
