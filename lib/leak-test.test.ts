import { describe, expect, it } from "vitest";
import {
  groundClaims,
  keptText,
  readLeakClaims,
  reintroducedPatternLeaks,
  residualTokenLeaks,
  probeLeakTest,
  runLeakTest,
  scoreLeaks,
  stripMaskTokens,
} from "./leak-test";
import type { LeakRunner, ModelRunner } from "./model";
import type { Finding, ScanContext } from "./types";

const CONTEXT: ScanContext = {
  purpose: "general",
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
    label: "PERSON",
    severity: "high",
    quote,
    start,
    end: start + quote.length,
    source: "model",
    decision,
    replacement,
  };
}

function scanRunner(raw: string): ModelRunner {
  return async (_text, tier) => ({
    ok: true,
    raw,
    tier,
    source: "on_device",
    charsSent: 0,
  });
}

describe("the clean copy", () => {
  it("drops the tool's own tokens before a rule can fire on them", () => {
    const copy = "Write to [REDACTED:EMAIL] or [REDACTED:PHONE].";
    expect(stripMaskTokens(copy)).not.toContain("REDACTED");
  });

  it("keeps what was left alone and takes out what was not", () => {
    const text = "Call Jane about Acme.";
    const kept = keptText(text, [
      finding(text, "Jane", "redact"),
      finding(text, "Acme", "retain"),
    ]);

    expect(kept).toContain("Acme");
    expect(kept).not.toContain("Jane");
  });
});

describe("the programmatic checks", () => {
  it("catches a name that came back through the rewrite", () => {
    const text = "Northwind Logistics is the firm.";
    const leaks = residualTokenLeaks(
      text,
      [finding(text, "Northwind Logistics", "redact")],
      "Northwind Logistics is the firm."
    );

    expect(leaks).toHaveLength(1);
    expect(leaks[0].kind).toBe("residual_token");
  });

  it("does not call a leak when the name was there on purpose", () => {
    const text = "Northwind Logistics is the firm.";
    const leaks = residualTokenLeaks(
      text,
      [finding(text, "Northwind Logistics", "retain")],
      "Northwind Logistics is the firm."
    );

    expect(leaks).toHaveLength(0);
  });

  it("catches a secret that came back in a new form", () => {
    const leaks = reintroducedPatternLeaks("Write to ada@example.com about it.");
    expect(leaks.length).toBeGreaterThan(0);
    expect(leaks[0].kind).toBe("pattern_reintroduced");
  });

  it("does not fire on the tokens it put there itself", () => {
    expect(reintroducedPatternLeaks("Write to [REDACTED:EMAIL].")).toHaveLength(0);
  });
});

describe("the model's claims", () => {
  it("reads claims out of the shapes a small model produces", () => {
    expect(
      readLeakClaims('{"claims":[{"claim":"a","quote":"b"}]}')
    ).toEqual([{ claim: "a", quote: "b" }]);

    expect(
      readLeakClaims('{"findings":[{"observation":"a","excerpt":"b"}]}')
    ).toEqual([{ claim: "a", quote: "b" }]);
  });

  it("throws away output that is not a claim at all", () => {
    expect(readLeakClaims("not json")).toEqual([]);
    expect(readLeakClaims("{}")).toEqual([]);
  });

  it("keeps a claim that quotes the copy", () => {
    const copy = "The meeting is in Berlin.";
    const leaks = groundClaims(
      [{ claim: "The city narrows the firm down.", quote: "in Berlin" }],
      copy,
      []
    );

    expect(leaks).toHaveLength(1);
    expect(leaks[0].citation).toBe("in Berlin");
  });

  it("drops a claim that quotes nothing, because a guess is not evidence", () => {
    const leaks = groundClaims(
      [{ claim: "It is probably Northwind.", quote: "" }],
      "The meeting is in Berlin.",
      []
    );

    expect(leaks).toHaveLength(0);
  });

  it("drops a claim that quotes something that is not in the copy", () => {
    const leaks = groundClaims(
      [{ claim: "The city narrows it down.", quote: "in Lisbon" }],
      "The meeting is in Berlin.",
      []
    );

    expect(leaks).toHaveLength(0);
  });

  it("drops a claim that carries the secret it is about", () => {
    const text = "Northwind Logistics is the firm.";
    const leaks = groundClaims(
      [{ claim: "The firm is Northwind.", quote: "is the firm" }],
      "a logistics firm is the firm.",
      [finding(text, "Northwind Logistics", "redact")]
    );

    expect(leaks).toHaveLength(0);
  });
});

describe("the score", () => {
  it("is clean when nothing was found", () => {
    expect(scoreLeaks([])).toEqual({ verdict: "CLEAN", score: 0 });
  });

  it("is traceable when the worst thing is an inference", () => {
    const { verdict, score } = scoreLeaks([
      { kind: "inference", severity: "medium", detail: "a clue" },
    ]);

    expect(verdict).toBe("TRACEABLE");
    expect(score).toBe(20);
  });

  it("is leaking when something came back", () => {
    const { verdict, score } = scoreLeaks([
      { kind: "residual_token", severity: "high", detail: "a name" },
    ]);

    expect(verdict).toBe("LEAKING");
    expect(score).toBe(40);
  });

  it("stops at a hundred", () => {
    const { score } = scoreLeaks(
      Array.from({ length: 10 }, () => ({
        kind: "residual_token" as const,
        severity: "high" as const,
        detail: "a name",
      }))
    );

    expect(score).toBe(100);
  });
});

describe("the whole test", () => {
  const text = "Hi, my name is Northwind Logistics, email ada@example.com.";

  it("scrubs the text, then reports what the copy still gives away", async () => {
    const scanned = await runLeakTest(text, {
      context: CONTEXT,
      runner: scanRunner(
        '{"findings":[{"type":"PERSON","quote":"Northwind Logistics","decision":"redact","replacement":"a logistics firm"}]}'
      ),
    });

    expect(scanned.cleanCopy).not.toContain("Northwind");
    expect(scanned.cleanCopy).not.toContain("ada@example.com");
    expect(scanned.verdict).toBe("CLEAN");
    expect(scanned.leaks).toEqual([]);
    expect(scanned.probe).toBeUndefined();
  });

  it("runs the model attack only when it is asked for", async () => {
    const scanned = await runLeakTest(text, {
      context: CONTEXT,
      runner: scanRunner(
        '{"findings":[{"type":"PERSON","quote":"Northwind Logistics","decision":"redact","replacement":"a logistics firm"}]}'
      ),
    });

    const result = await probeLeakTest(scanned, {
      leakRunner: async () => ({
        ok: true,
        raw: '{"claims":[{"claim":"The sender says where they work, but the firm is gone.","quote":"my name is"}]}',
        tier: "on_device",
        source: "on_device",
        charsSent: 0,
      }),
    });

    expect(result.verdict).toBe("TRACEABLE");
    expect(result.leaks.some((leak) => leak.kind === "inference")).toBe(true);
    expect(result.probe?.charsSent).toBe(0);
  });

  it("never hands the original to the probe", async () => {
    let seen = "";

    const leakRunner: LeakRunner = async (cleanCopy) => {
      seen = cleanCopy;
      return {
        ok: true,
        raw: '{"claims":[]}',
        tier: "on_device",
        source: "on_device",
        charsSent: 0,
      };
    };

    const scanned = await runLeakTest(text, {
      context: CONTEXT,
      runner: scanRunner(
        '{"findings":[{"type":"PERSON","quote":"Northwind Logistics","decision":"redact","replacement":"a logistics firm"}]}'
      ),
    });

    await probeLeakTest(scanned, { leakRunner });

    expect(seen).not.toContain("Northwind");
    expect(seen).not.toContain("ada@example.com");
  });

  it("still gives a verdict when the probe could not run", async () => {
    const scanned = await runLeakTest(text, {
      context: CONTEXT,
      runner: scanRunner(
        '{"findings":[{"type":"PERSON","quote":"Northwind Logistics","decision":"redact","replacement":"a logistics firm"}]}'
      ),
    });

    const result = await probeLeakTest(scanned, {
      leakRunner: async () => ({
        ok: false,
        raw: "",
        tier: "on_device",
        source: "on_device",
        charsSent: 0,
        error: "no model",
      }),
    });

    expect(result.probe?.error).toBe("no model");
    expect(result.verdict).toBe("CLEAN");
  });

  it("leaves the result alone when there is no probe runner", async () => {
    const scanned = await runLeakTest(text, {
      context: CONTEXT,
      runner: scanRunner(
        '{"findings":[{"type":"PERSON","quote":"Northwind Logistics","decision":"redact","replacement":"a logistics firm"}]}'
      ),
    });

    const result = await probeLeakTest(scanned, {});

    expect(result).toBe(scanned);
  });
});
