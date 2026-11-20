import { describe, expect, it } from "vitest";
import { toFindings } from "./model";
import { schemaHint } from "./prompt";
import { DEFAULT_CONTEXT } from "./purpose";

/**
 * The model tier is the part of REDACT that cannot be controlled, so the
 * parts around it have to be. These tests cover what the pipeline does with
 * an answer the model gave: a well-formed one, one it cannot parse whole, and
 * one that points at a field label rather than at the value under it.
 */

const TEXT = "Hi, Ada Lovelace, my email is ada@example.com.";

describe("a model answer", () => {
  it("resolves a quote the model actually found", () => {
    const { findings } = toFindings(
      TEXT,
      '{"findings":[{"type":"PERSON","quote":"Ada Lovelace"}]}'
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].quote).toBe("Ada Lovelace");
  });

  it("reads the findings out of an answer it cannot parse whole", () => {
    // The shape a small on-device model produces when it copies a schema it
    // only half remembers: an array that closes and then carries on.
    const raw =
      '{"findings": [{"type": "PERSON", "quote": "Ada Lovelace"}], ' +
      '{"type": "EMAIL", "quote": "ada@example.com"}]';

    const { findings, error } = toFindings(TEXT, raw);

    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.quote)).toEqual([
      "Ada Lovelace",
      "ada@example.com",
    ]);
    expect(error).toBeTruthy();
  });

  it("reports the answer as unreadable when there is nothing in it", () => {
    const { findings, error } = toFindings(TEXT, "I could not find anything.");

    expect(findings).toHaveLength(0);
    expect(error).toBeTruthy();
  });

  it("does not report the same finding twice", () => {
    const { findings } = toFindings(
      TEXT,
      '{"findings":[{"type":"PERSON","quote":"Ada Lovelace"}]}'
    );
    const again = toFindings(
      TEXT,
      '{"findings":[{"type":"PERSON","quote":"Ada Lovelace"}]}'
    );

    expect(findings).toHaveLength(1);
    expect(again.findings).toHaveLength(1);
  });
});

describe("a field label", () => {
  it("is followed to the value under it", () => {
    const form = "FULL NAME\nAmara Okonkwo";

    const { findings } = toFindings(
      form,
      '{"findings":[{"type":"PERSON","quote":"FULL NAME"}]}'
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].quote).toBe("Amara Okonkwo");
    expect(findings[0].type).toBe("PERSON");
  });

  it("is followed to the value after it on the same line", () => {
    const form = "Phone: +44 7700 900418";

    const { findings } = toFindings(
      form,
      '{"findings":[{"type":"PHONE","quote":"Phone"}]}'
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].quote).toBe("+44 7700 900418");
  });

  it("is never covered itself", () => {
    const form = "FULL NAME\nAmara Okonkwo";

    const { findings } = toFindings(
      form,
      '{"findings":[{"type":"PERSON","quote":"FULL NAME"}]}'
    );

    expect(form.slice(findings[0].start, findings[0].end)).toBe(
      "Amara Okonkwo"
    );
  });
});

describe("the shape the model is given", () => {
  it("is JSON the model can copy", () => {
    const hint = schemaHint(DEFAULT_CONTEXT);
    const json = hint.slice(hint.indexOf("{")).replace(/: <[^>]*>/g, ': "x"');

    expect(() => JSON.parse(json)).not.toThrow();
  });
});
