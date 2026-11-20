import { findPatterns } from "./patterns";
import type { Finding, OutputForm } from "./types";

/**
 * Writing the clean copy.
 *
 * The model is asked to rewrite a sensitive span into something generic, and
 * then it is asked to keep that rewrite. That second step is the dangerous
 * one: a model that is bad at redacting can produce a "generalisation" that
 * still carries the secret, and a privacy tool that ships a leak is worse
 * than one that ships a token.
 *
 * So the model is never the judge of its own redaction. Every rewrite is
 * checked here, and a rewrite that fails the check is thrown away in favour
 * of a token. The rewrite is a nicety; the token is the guarantee.
 */

/**
 * Types that are never rewritten. A credential has no safe shorter form:
 * "a card number" is not a redaction of a card number, it is a different
 * claim, and "ending in 1111" is still four digits of someone's card.
 */
export const CREDENTIAL_TYPES: ReadonlySet<string> = new Set([
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
  "API_KEY",
  "PASSWORD",
  "CREDIT_CARD",
  "IBAN",
  "ACCOUNT_NUMBER",
  "IP_ADDRESS",
  "MAC_ADDRESS",
]);

export function isCredentialType(type: string): boolean {
  return CREDENTIAL_TYPES.has(type);
}

const TOKEN_PATTERN = /[A-Za-z0-9][A-Za-z0-9'’.]*/g;

/**
 * The words a rewrite must not contain.
 *
 * Two kinds. The first token of each run of capitalised words is the head of
 * a name: "Northwind Logistics" is checked on "Northwind", so "a logistics
 * firm" passes, but "Northwind Logistics" does not. The second kind is any
 * token holding three or more digits, which covers years, long identifiers and
 * account numbers while leaving small numbers like a house number alone.
 */
export function distinctiveTokens(quote: string): string[] {
  const tokens = quote.match(TOKEN_PATTERN) ?? [];
  const distinctive: string[] = [];

  let run: string[] = [];

  const flushRun = () => {
    if (run.length > 0) {
      const head = run[0];
      if (head.length >= 4) distinctive.push(head);
      run = [];
    }
  };

  for (const token of tokens) {
    if (/\d{3,}/.test(token)) distinctive.push(token);

    if (/^[A-Z]/.test(token)) {
      run.push(token);
    } else {
      flushRun();
    }
  }
  flushRun();

  return distinctive;
}

/**
 * True when the rewrite still carries the thing it was supposed to remove.
 *
 * Three checks, because each catches something the others miss:
 *
 * 1. The head of a name, or a long number, surviving into the rewrite.
 * 2. The whole quote surviving verbatim.
 * 3. A structurally sensitive thing surviving in the rewrite. The pattern
 *    tier runs on the rewrite itself, so an email that came back as
 *    "ada@example.com" is caught even though no word of it matched the head
 *    of a name.
 */
export function replacementLeaks(quote: string, replacement: string, type: string): boolean {
  const trimmed = replacement.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();

  for (const token of distinctiveTokens(quote)) {
    if (lower.includes(token.toLowerCase())) return true;
  }

  const quoteLower = quote.trim().toLowerCase();
  if (quoteLower.length >= 4 && lower.includes(quoteLower)) return true;

  for (const found of findPatterns(trimmed)) {
    if (found.type === type) return true;
    if (isCredentialType(found.type)) return true;
  }

  return false;
}

/**
 * The rewrite to use for a finding, or undefined when the model's suggestion
 * cannot be trusted and the span has to become a token.
 */
export function safeReplacement(
  type: string,
  quote: string,
  replacement: string | undefined
): string | undefined {
  if (!replacement || !replacement.trim()) return undefined;
  if (isCredentialType(type)) return undefined;
  if (replacementLeaks(quote, replacement, type)) return undefined;
  return replacement.trim();
}

/**
 * Writes the clean copy.
 *
 * Spans the purpose says are safe to keep stay exactly as they are. Spans
 * that are redacted become their rewrite when there is a trustworthy one, and
 * a token when there is not.
 */
export function applyOutput(text: string, findings: Finding[], form: OutputForm): string {
  const ordered = findings
    .filter((finding) => finding.decision === "redact")
    .sort((a, b) => a.start - b.start);

  let out = "";
  let cursor = 0;

  for (const finding of ordered) {
    if (finding.start < cursor) continue;
    out += text.slice(cursor, finding.start);
    out +=
      form === "rewritten" && finding.replacement
        ? finding.replacement
        : `[REDACTED:${finding.type}]`;
    cursor = finding.end;
  }

  out += text.slice(cursor);
  return out;
}
