import { describe, expect, it } from "vitest";
import { maskText } from "./offsets";
import { parseLooseJson } from "./parse";
import { findPatterns } from "./patterns";
import { toFindings, type ModelRunner, type Tier } from "./model";
import { scrub, ON_DEVICE_TOKEN_BUDGET } from "./scrub";

/**
 * These tests cover the part of REDACT that does not need a browser, a
 * network, or a Firebase project: the pattern tier, the tolerant parser, the
 * quote-to-offset step, the merge, and the tier escalation logic.
 *
 * The model tier is injected. That is deliberate, and it is why the whole
 * pipeline is testable on a machine with no Gemini model downloaded.
 */

function runnerFor(
  raw: string,
  options: { source?: "on_device" | "in_cloud"; ok?: boolean; error?: string } = {}
): { runner: ModelRunner; tiers: Tier[] } {
  const tiers: Tier[] = [];
  const runner: ModelRunner = async (_text, tier) => {
    tiers.push(tier);
    return {
      ok: options.ok ?? true,
      raw,
      tier,
      source: options.source ?? "on_device",
      charsSent: options.source === "in_cloud" ? 100 : 0,
      error: options.error,
    };
  };
  return { runner, tiers };
}

describe("the pattern tier", () => {
  it("catches a fixed-shape credential", () => {
    const findings = findPatterns("key AKIAIOSFODNN7EXAMPLE here");
    expect(findings.some((f) => f.type === "AWS_ACCESS_KEY")).toBe(true);
  });

  it("catches an email address", () => {
    const findings = findPatterns("write to ada@example.com today");
    expect(findings.some((f) => f.type === "EMAIL")).toBe(true);
  });

  it("catches a phone number", () => {
    const findings = findPatterns("call +14155550132 now");
    expect(findings.some((f) => f.type === "PHONE")).toBe(true);
  });

  it("calls a sixteen digit number a card only when Luhn agrees", () => {
    const valid = findPatterns("card 4111111111111111 ok");
    expect(valid.some((f) => f.type === "CREDIT_CARD")).toBe(true);

    const invalid = findPatterns("order 1234567890123456 ok");
    expect(invalid.some((f) => f.type === "CREDIT_CARD")).toBe(false);
  });

  it("calls a string an IBAN only when the country code and mod-97 agree", () => {
    const valid = findPatterns("pay to GB82WEST12345698765432 today");
    expect(valid.some((f) => f.type === "IBAN")).toBe(true);

    const apiKey = "sk-proj-WV2496E2BQ1M3EKVPBP75C-ENVP6G6WDJ4B43XFZ";
    const invalid = findPatterns("key " + apiKey + " here");
    expect(invalid.some((f) => f.type === "IBAN")).toBe(false);
    expect(invalid.some((f) => f.type === "OPENAI_API_KEY")).toBe(true);
  });

  it("marks a credential as critical and an email as high", () => {
    const findings = findPatterns("AKIAIOSFODNN7EXAMPLE ada@example.com");
    const key = findings.find((f) => f.type === "AWS_ACCESS_KEY");
    const email = findings.find((f) => f.type === "EMAIL");
    expect(key?.severity).toBe("critical");
    expect(email?.severity).toBe("high");
  });
});

describe("the tolerant parser", () => {
  it("reads JSON out of a code fence", () => {
    const result = parseLooseJson("```json" + "\n" + '{"findings":[]}' + "\n" + "```");
    expect(result.ok).toBe(true);
  });

  it("repairs a trailing comma", () => {
    const result = parseLooseJson('{"findings":[{"type":"PERSON"}],}');
    expect(result.ok).toBe(true);
  });

  it("finds JSON wrapped in prose", () => {
    const result = parseLooseJson('Here you go: {"findings":[{"type":"PERSON","quote":"Ada"}]} done');
    expect(result.ok).toBe(true);
  });

  it("reports a failure instead of throwing", () => {
    const result = parseLooseJson("no json at all");
    expect(result.ok).toBe(false);
  });
});

describe("the offset step", () => {
  const text = "Hi, Ada Lovelace, my email is ada@example.com.";

  it("resolves a quote the model actually found", () => {
    const { findings } = toFindings(text, '{"findings":[{"type":"PERSON","quote":"Ada Lovelace"}]}');
    expect(findings).toHaveLength(1);
    expect(findings[0].quote).toBe("Ada Lovelace");
    expect(text.slice(findings[0].start, findings[0].end)).toBe("Ada Lovelace");
    expect(findings[0].source).toBe("model");
  });

  it("drops a quote that is not in the source", () => {
    const { findings } = toFindings(text, '{"findings":[{"type":"PERSON","quote":"Grace Hopper"}]}');
    expect(findings).toHaveLength(0);
  });

  it("drops a finding whose model answer is not JSON", () => {
    const { findings, error } = toFindings(text, "I could not find anything.");
    expect(findings).toHaveLength(0);
    expect(error).toBeTruthy();
  });

  it("does not trust a model-supplied offset over the quote", () => {
    const { findings } = toFindings(
      text,
      '{"findings":[{"type":"PERSON","quote":"Ada Lovelace","start":900,"end":950}]}'
    );
    expect(findings[0].start).toBe(text.indexOf("Ada Lovelace"));
    expect(findings[0].end).toBe(text.indexOf("Ada Lovelace") + "Ada Lovelace".length);
  });
});

describe("the masking step", () => {
  it("replaces a span with a token that names the type", () => {
    const text = "key AKIAIOSFODNN7EXAMPLE here";
    const findings = findPatterns(text);
    expect(maskText(text, findings)).toBe("key [REDACTED:AWS_ACCESS_KEY] here");
  });

  it("keeps the text outside the spans untouched", () => {
    const text = "key AKIAIOSFODNN7EXAMPLE here";
    const masked = maskText(text, findPatterns(text));
    expect(masked).toContain("key ");
    expect(masked).toContain(" here");
    expect(masked).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });
});

describe("the whole scan", () => {
  it("runs the pattern tier alone when there is no model runner", async () => {
    const result = await scrub("key AKIAIOSFODNN7EXAMPLE here");
    expect(result.inferenceSource).toBe("PATTERNS_ONLY");
    expect(result.charsSent).toBe(0);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("merges pattern findings and model findings", async () => {
    const text = "Hi, Ada Lovelace, my email is ada@example.com.";
    const { runner } = runnerFor('{"findings":[{"type":"PERSON","quote":"Ada Lovelace"}]}');
    const result = await scrub(text, { runner });

    expect(result.patternCount).toBe(1);
    expect(result.modelCount).toBe(1);
    expect(result.findings).toHaveLength(2);
  });

  it("reports zero characters sent when the run stayed on the device", async () => {
    const { runner } = runnerFor('{"findings":[]}');
    const result = await scrub("hello", { runner });

    expect(result.inferenceSource).toBe("ON_DEVICE");
    expect(result.charsSent).toBe(0);
    expect(result.escalated).toBe(false);
  });

  it("escalates to the cloud when the text is too large for the device", async () => {
    const long = "a".repeat((ON_DEVICE_TOKEN_BUDGET + 1) * 4);
    const { runner, tiers } = runnerFor('{"findings":[]}', { source: "in_cloud" });
    const result = await scrub(long, { runner });

    expect(tiers).toEqual(["cloud"]);
    expect(result.inferenceSource).toBe("IN_CLOUD");
    expect(result.escalated).toBe(true);
  });

  it("retries in the cloud when the on-device run fails in auto mode", async () => {
    const { runner, tiers } = runnerFor("", { ok: false, error: "No model." });
    const result = await scrub("hello", { runner, mode: "auto" });

    expect(tiers).toEqual(["on_device", "cloud"]);
    expect(result.degradedReason).toBeTruthy();
  });

  it("honours a deliberate on-device choice instead of escalating", async () => {
    const { runner, tiers } = runnerFor("", { ok: false, error: "No model." });
    const result = await scrub("hello", { runner, mode: "on_device" });

    expect(tiers).toEqual(["on_device"]);
    expect(result.escalated).toBe(false);
    expect(result.inferenceSource).toBe("PATTERNS_ONLY");
    expect(result.degradedReason).toBe("No model.");
  });

  it("reports the tier that actually ran, not the tier that was asked for", async () => {
    const { runner } = runnerFor('{"findings":[]}', { source: "in_cloud" });
    const result = await scrub("hello", { runner, mode: "on_device" });

    expect(result.inferenceSource).toBe("IN_CLOUD");
    expect(result.escalated).toBe(false);
    expect(result.charsSent).toBe(100);
  });

  it("still finds the credential when the model tier is broken", async () => {
    const { runner } = runnerFor("", { ok: false, error: "No model." });
    const result = await scrub("key AKIAIOSFODNN7EXAMPLE here", { runner });

    expect(result.findings.some((f) => f.type === "AWS_ACCESS_KEY")).toBe(true);
  });
});
