import { applyOutput, isCredentialType } from "./rewrite";
import type { Finding, Severity } from "./types";

/**
 * Turning a model answer into a finding.
 *
 * The model is never trusted with offsets. It is asked for the exact quote it
 * found, and we locate that quote in the source text ourselves. Offsets from a
 * model are a guess; a quote is checkable.
 */

const SPACE = 32;
const TAB = 9;
const NEWLINE = 10;
const CARRIAGE_RETURN = 13;

function isWhitespaceCode(code: number): boolean {
  return code === SPACE || code === TAB || code === NEWLINE || code === CARRIAGE_RETURN;
}

function isTokenChar(ch: string): boolean {
  return /[0-9A-Za-z]/.test(ch);
}

/** Collapses runs of whitespace to a single space, keeping an index map. */
function normaliseWithMap(text: string): { text: string; map: number[] } {
  let out = "";
  const map: number[] = [];
  let lastWasSpace = false;

  for (let i = 0; i < text.length; i++) {
    if (isWhitespaceCode(text.charCodeAt(i))) {
      if (!lastWasSpace) {
        out += " ";
        map.push(i);
        lastWasSpace = true;
      }
      continue;
    }
    out += text.charAt(i);
    map.push(i);
    lastWasSpace = false;
  }

  return { text: out, map };
}

function collapseWhitespace(input: string): string {
  let out = "";
  let lastWasSpace = false;
  for (let i = 0; i < input.length; i++) {
    if (isWhitespaceCode(input.charCodeAt(i))) {
      if (!lastWasSpace) {
        out += " ";
        lastWasSpace = true;
      }
      continue;
    }
    out += input.charAt(i);
    lastWasSpace = false;
  }
  return out;
}

export interface Span {
  start: number;
  end: number;
}

/**
 * Locates a quote inside the source text. Tries, in order: exact match,
 * case-insensitive match, whitespace-collapsed match, whitespace-collapsed
 * case-insensitive match, and finally an in-order token match.
 *
 * Returns null when the quote does not appear in the text at all. A quote the
 * model invented is discarded rather than trusted.
 */
export function locateQuote(text: string, quote: string): Span | null {
  const needle = quote.trim();
  if (!needle) return null;

  const exact = text.indexOf(needle);
  if (exact !== -1) {
    return { start: exact, end: exact + needle.length };
  }

  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const ci = lowerText.indexOf(lowerNeedle);
  if (ci !== -1) {
    return { start: ci, end: ci + needle.length };
  }

  const normalised = normaliseWithMap(text);
  const collapsedNeedle = collapseWhitespace(needle);
  const collapsedIndex = normalised.text.indexOf(collapsedNeedle);
  if (collapsedIndex !== -1) {
    const start = normalised.map[collapsedIndex];
    const last = normalised.map[collapsedIndex + collapsedNeedle.length - 1];
    if (start !== undefined && last !== undefined) {
      return { start, end: last + 1 };
    }
  }

  const collapsedCiIndex = normalised.text.toLowerCase().indexOf(collapsedNeedle.toLowerCase());
  if (collapsedCiIndex !== -1) {
    const start = normalised.map[collapsedCiIndex];
    const last = normalised.map[collapsedCiIndex + collapsedNeedle.length - 1];
    if (start !== undefined && last !== undefined) {
      return { start, end: last + 1 };
    }
  }

  return locateByTokens(text, needle);
}

/**
 * The last resort: the quote's words all appear in the source, in order,
 * within a short window. Catches a model that reworded a name or dropped a
 * piece of punctuation.
 */
function locateByTokens(text: string, quote: string): Span | null {
  const quoteTokens: string[] = [];
  let current = "";
  for (const ch of quote) {
    if (isTokenChar(ch)) {
      current += ch;
    } else if (current) {
      quoteTokens.push(current);
      current = "";
    }
  }
  if (current) quoteTokens.push(current);

  if (quoteTokens.length === 0) return null;

  const lowerTokens = quoteTokens.map((token) => token.toLowerCase());
  const textTokens: { token: string; start: number; end: number }[] = [];
  current = "";
  let tokenStart = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (isTokenChar(ch)) {
      if (!current) tokenStart = i;
      current += ch;
    } else if (current) {
      textTokens.push({ token: current.toLowerCase(), start: tokenStart, end: i });
      current = "";
    }
  }
  if (current) {
    textTokens.push({
      token: current.toLowerCase(),
      start: tokenStart,
      end: text.length,
    });
  }

  for (let i = 0; i + lowerTokens.length <= textTokens.length; i++) {
    let matched = true;
    for (let j = 0; j < lowerTokens.length; j++) {
      if (textTokens[i + j].token !== lowerTokens[j]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return { start: textTokens[i].start, end: textTokens[i + lowerTokens.length - 1].end };
    }
  }

  return null;
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 3,
  high: 2,
  low: 1,
};

/**
 * Removes findings that describe the same span as another finding.
 *
 * When two findings overlap by more than half of the shorter one, the one
 * with the lower severity is dropped. Ties keep the pattern-tier finding,
 * because it is deterministic and reproducible.
 */
export function mergeFindings(findings: Finding[]): Finding[] {
  const sorted = [...findings].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const spanA = a.end - a.start;
    const spanB = b.end - b.start;
    if (spanA !== spanB) return spanB - spanA;
    return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  });

  const kept: Finding[] = [];

  for (const finding of sorted) {
    const conflict = kept.find((existing) => overlaps(existing, finding));

    if (!conflict) {
      kept.push(finding);
      continue;
    }

    const existingRank = SEVERITY_RANK[conflict.severity];
    const findingRank = SEVERITY_RANK[finding.severity];

    if (findingRank > existingRank) {
      kept[kept.indexOf(conflict)] = finding;
    }
  }

  return kept.sort((a, b) => a.start - b.start);
}

function overlaps(a: Finding, b: Finding): boolean {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  if (end <= start) return false;

  const shared = end - start;
  const shorter = Math.min(a.end - a.start, b.end - b.start);
  return shorter > 0 && shared / shorter > 0.5;
}

/**
 * Applies retentions.
 *
 * A retention is the model saying "this span is needed for the purpose", and
 * it cancels the pattern-tier finding for the same span. It never cancels
 * another model finding: when the model contradicts itself about a span, the
 * span is redacted, not kept. It never cancels a credential either, because a
 * purpose is a hint and a secret is not.
 */
export function resolveRetentions(findings: Finding[]): Finding[] {
  const retained = findings.filter((finding) => finding.decision === "retain");
  if (retained.length === 0) return findings;

  return findings.filter((finding) => {
    if (finding.decision === "retain") return true;
    if (finding.source !== "pattern") return true;
    if (isCredentialType(finding.type)) return true;
    return !retained.some((keep) => overlaps(keep, finding));
  });
}

/**
 * Replaces every finding span with a mask token. The token names the type so
 * the reader still knows what was removed: `[REDACTED:AWS_ACCESS_KEY]`.
 */
export function maskText(text: string, findings: Finding[]): string {
  return applyOutput(text, findings, "token");
}
