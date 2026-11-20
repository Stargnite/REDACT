/**
 * The instruction sent to whichever tier is running.
 *
 * Two rules matter more than anything else in this file:
 *
 * 1. The model must return the EXACT substring it found. We locate that
 *    substring in the source text ourselves. A model-supplied offset is a
 *    guess; a quote is something we can check.
 * 2. The model must not return the redacted text. It returns quotes, and we
 *    do the masking. That keeps the substitution rule in one place.
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

export const SYSTEM_INSTRUCTION = `You are a redaction scanner. You read a block of text and report every span that would be sensitive if that text were pasted into an AI assistant.

Rules:
1. Report the EXACT characters you found, copied verbatim from the input. Do not paraphrase, normalise, or correct them.
2. Do not report character offsets. We locate the quote ourselves.
3. Do not report the same span twice.
4. If you are not confident, leave it out. A false positive costs the user more trust than a miss costs them safety.
5. Report a person's name only when the text gives you a reason to believe it is a real name and not a product, a placeholder, or an example.
6. Report nothing at all if the text contains nothing sensitive.`;

export const OUTPUT_SHAPE = '{"findings": [{"type": "EMAIL", "quote": "jane@example.com"}]}';

export const SCHEMA_HINT = `Return ONLY JSON, with this exact shape and nothing else:
{"findings": [{"type": "<one of: ${TYPES.join(", ")}>", "quote": "<exact text copied from the input>"}]}`;
