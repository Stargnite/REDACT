import { allowsRetention, purposeInstruction } from "./purpose";
import type { ScanContext } from "./types";

/**
 * The instruction sent to whichever tier is running.
 *
 * Three rules matter more than anything else in this file:
 *
 * 1. The model must return the EXACT substring it found. We locate that
 *    substring in the source text ourselves. A model-supplied offset is a
 *    guess; a quote is something we can check.
 * 2. The model must not return the redacted text. It returns quotes, and we
 *    do the masking. That keeps the substitution rule in one place.
 * 3. The model is told where the text is going. The same span is sensitive
 *    for one purpose and necessary for another, and only the purpose can
 *    settle that.
 */

export const TYPES = [
  "AWS_ACCESS_KEY",
  "AWS_SECRET_ACCESS_KEY",
  "GOOGLE_API_KEY",
  "GITHUB_TOKEN",
  "SLACK_TOKEN",
  "STRIPE_SECRET_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "PRIVATE_KEY",
  "JWT",
  "SENDGRID_API_KEY",
  "SLACK_WEBHOOK",
  "NPM_TOKEN",
  "TWILIO_ACCOUNT_SID",
  "CREDIT_CARD",
  "IBAN",
  "EMAIL",
  "PHONE",
  "PERSON",
  "DATE_OF_BIRTH",
  "HOME_ADDRESS",
  "EMPLOYER",
  "LOCATION",
  "IP_ADDRESS",
  "MAC_ADDRESS",
  "ACCOUNT_NUMBER",
];

const BASE_RULES = `Rules:
1. Report the EXACT characters you found, copied verbatim from the input. Do not paraphrase, normalise, or correct them.
2. Do not report character offsets. We locate the quote ourselves.
3. Do not report the same span twice.
4. If you are not confident, leave it out. A false positive costs the user more trust than a miss costs them safety.
5. Report a person's name only when the text gives you a reason to believe it is a real name and not a product, a placeholder, or an example.
6. Report nothing at all if the text contains nothing sensitive.`;

const RETENTION_RULE = `7. Set "decision" to "retain" only when the purpose says the span is needed for it. When you are unsure, set "decision" to "redact".`;

const NO_RETENTION_RULE = `7. Set "decision" to "redact" for every span. Nothing is safe to keep for this purpose.`;

const REWRITE_RULE = `8. The "replacement" must not contain any part of the original name, number, address or identifier. "Northwind Logistics" becomes "a logistics firm", never "Northwind Co". Never write a replacement for a credential such as an API key or a card number.`;

export const OUTPUT_SHAPE = '{"findings": [{"type": "EMAIL", "quote": "jane@example.com"}]}';

/**
 * The full instruction for one scan, given what the text is for.
 *
 * The purpose paragraph is the whole of purpose-aware redaction. Everything
 * else is the same for every scan.
 */
export function systemInstruction(context: ScanContext): string {
  const retentionRule = allowsRetention(context)
    ? RETENTION_RULE
    : NO_RETENTION_RULE;

  const rewriteRule =
    context.outputForm === "rewritten" ? `\n${REWRITE_RULE}` : "";

  return `You are a redaction scanner. You read a block of text and report every span that would be sensitive if that text were pasted into an AI assistant.

${BASE_RULES}
${retentionRule}${rewriteRule}

Purpose:
${purposeInstruction(context)}`;
}

/**
 * The JSON shape the model has to answer with, for one scan.
 *
 * The shape changes with the context, and it is deliberately smaller when
 * there is less to say. A model asked for fewer fields gives fewer wrong
 * ones, and the on-device model is small enough that every field costs.
 */
export function schemaHint(context: ScanContext): string {
  const retention = allowsRetention(context);

  const fields = [
    `"type": "<one of: ${TYPES.join(", ")}>"`,
    `"quote": "<exact text copied from the input>"`,
    retention
      ? `"decision": "redact" | "retain"`
      : `"decision": "redact"`,
    `"reason": "<a few words on why this matters>"`,
  ];

  if (context.outputForm === "rewritten") {
    fields.push(
      `"replacement": "<the quote rewritten generically, every identifying detail removed>"`
    );
  }

  return `Return ONLY JSON, with this exact shape and nothing else:
{"findings": [${fields.join(", ")}]}`;
}
