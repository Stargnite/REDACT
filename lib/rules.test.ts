import { describe, expect, it } from "vitest";
import { findPatterns } from "./patterns";
import { passesIban } from "./rules";

const ANTHROPIC_KEY =
  "sk-ant-LGM2LZKHK6FHEB00KW-GM1Z9MPKVA-E-EE661VQFORL12-VBAPB4RB1OFCQ4W9BNAYOYZNRI88X-9BZPFJF3";

describe("the rule set", () => {
  it("calls a string an IBAN only when the country code and mod-97 agree", () => {
    expect(passesIban("GB82WEST12345698765432")).toBe(true);
    expect(passesIban("DE89370400440532013000")).toBe(true);
    expect(passesIban("WV2496E2BQ1M3EKVPBP75C")).toBe(false);
  });

  it("does not call an Anthropic key an OpenAI key as well", () => {
    const findings = findPatterns("key " + ANTHROPIC_KEY + " here");
    expect(findings.filter((f) => f.type === "ANTHROPIC_API_KEY")).toHaveLength(1);
    expect(findings.some((f) => f.type === "OPENAI_API_KEY")).toBe(false);
  });
});
