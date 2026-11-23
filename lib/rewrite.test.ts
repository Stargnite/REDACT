import { describe, expect, it } from "vitest";
import { maskText } from "./offsets";
import { toFindings, type ModelRunner } from "./model";
import {
  applyOutput,
  distinctiveTokens,
  replacementLeaks,
  safeReplacement,
} from "./rewrite";
import { scrub } from "./scrub";
import type { Finding, ScanContext } from "./types";

const GENERAL_REWRITTEN: ScanContext = {
  purpose: "general",
  outputForm: "rewritten",
};

const SUPPORT: ScanContext = {
  purpose: "support_ticket",
  outputForm: "rewritten",
};

function finding(
  text: string,
  quote: string,
  decision: "redact" | "retain",
  replacement?: string
): Finding {
  const start = text.indexOf(quote);
  return {
    type: "PERSON",
    label: "Person",
    severity: "high",
    quote,
    start,
    end: start + quote.length,
    source: "model",
    decision,
    replacement,
  };
}

function runnerFor(raw: string): ModelRunner {
  return async (_text, tier) => ({
    ok: true,
    raw,
    tier,
    source: "on_device",
    charsSent: 0,
  });
}

describe("the leak guard", () => {
  it("takes the head of a name, not every word in it", () => {
    expect(distinctiveTokens("Northwind Logistics")).toEqual(["Northwind"]);
  });

  it("takes a long number as identifying", () => {
    expect(distinctiveTokens("account 123456789")).toContain("123456789");
  });

  it("lets a rewrite that keeps only an ordinary word through", () => {
    expect(
      replacementLeaks("Northwind Logistics", "a logistics firm", "EMPLOYER")
    ).toBe(false);
  });

  it("rejects a rewrite that keeps the name", () => {
    expect(
      replacementLeaks("Northwind Logistics", "Northwind Logistics Ltd", "EMPLOYER")
    ).toBe(true);
  });

  it("rejects a rewrite that keeps the first name only", () => {
    expect(replacementLeaks("Priya Raman", "Priya, a manager", "PERSON")).toBe(true);
  });

  it("rejects a rewrite that brings an email back", () => {
    expect(replacementLeaks("jane@example.com", "ada@example.com", "EMAIL")).toBe(
      true
    );
  });

  it("never rewrites a credential", () => {
    expect(
      safeReplacement("AWS_ACCESS_KEY", "AKIAIOSFODNN7EXAMPLE", "a key")
    ).toBeUndefined();
    expect(safeReplacement("CREDIT_CARD", "4111111111111111", "a card")).toBeUndefined();
  });

  it("keeps a rewrite that carries nothing identifying", () => {
    expect(safeReplacement("PERSON", "Priya Raman", "the author")).toBe("the author");
  });
});

describe("the clean copy", () => {
  it("writes the rewrite when one is trusted", () => {
    const text = "Contact Priya Raman today.";
    const findings = [finding(text, "Priya Raman", "redact", "the author")];
    expect(applyOutput(text, findings, "rewritten")).toBe("Contact the author today.");
  });

  it("writes a token when the form is tokens", () => {
    const text = "Contact Priya Raman today.";
    const findings = [finding(text, "Priya Raman", "redact", "the author")];
    expect(applyOutput(text, findings, "token")).toBe(
      "Contact [REDACTED:PERSON] today."
    );
  });

  it("leaves a retained span exactly as it was", () => {
    const text = "Contact Priya Raman today.";
    const findings = [finding(text, "Priya Raman", "retain")];
    expect(applyOutput(text, findings, "rewritten")).toBe(text);
  });
});

describe("the purpose", () => {
  const email = '{"findings":[{"type":"EMAIL","quote":"ada@example.com","decision":"retain"}]}';

  it("keeps nothing for a general scrub", () => {
    const { findings } = toFindings("write to ada@example.com now", email, {
      purpose: "general",
      outputForm: "token",
    });
    expect(findings[0].decision).toBe("redact");
  });

  it("keeps the contact details a support agent needs", () => {
    const { findings } = toFindings("write to ada@example.com now", email, SUPPORT);
    expect(findings[0].decision).toBe("retain");
  });

  it("never retains a credential, whatever the purpose", () => {
    const { findings } = toFindings(
      "key AKIAIOSFODNN7EXAMPLE here",
      '{"findings":[{"type":"AWS_ACCESS_KEY","quote":"AKIAIOSFODNN7EXAMPLE","decision":"retain"}]}',
      SUPPORT
    );
    expect(findings[0].decision).toBe("redact");
  });
});

describe("a scan under a purpose", () => {
  const email = '{"findings":[{"type":"EMAIL","quote":"ada@example.com","decision":"retain"}]}';

  it("keeps a retained span out of the redaction", async () => {
    const text = "write to ada@example.com today";
    const result = await scrub(text, {
      runner: runnerFor(email),
      context: SUPPORT,
    });
    expect(result.retainedCount).toBe(1);
    expect(maskText(text, result.findings)).toContain("ada@example.com");
  });

  it("redacts the same span for a general scrub", async () => {
    const text = "write to ada@example.com today";
    const result = await scrub(text, {
      runner: runnerFor(email),
      context: GENERAL_REWRITTEN,
    });
    expect(result.retainedCount).toBe(0);
    expect(maskText(text, result.findings)).not.toContain("ada@example.com");
  });

  it("never rewrites a credential, even in the rewritten form", async () => {
    const text = "key AKIAIOSFODNN7EXAMPLE here";
    const result = await scrub(text, {
      runner: runnerFor(
        '{"findings":[{"type":"AWS_ACCESS_KEY","quote":"AKIAIOSFODNN7EXAMPLE","replacement":"a key"}]}'
      ),
      context: GENERAL_REWRITTEN,
    });
    expect(applyOutput(text, result.findings, "rewritten")).toBe(
      "key [REDACTED:AWS_ACCESS_KEY] here"
    );
  });
});
