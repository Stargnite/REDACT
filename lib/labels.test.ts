import { describe, expect, it } from "vitest";
import { findLabelValues, labelType, valueAfterLabel } from "./labels";

/**
 * A field label is not sensitive, but it points at something that is. These
 * tests cover the pointer: which words are labels, and where the value they
 * introduce is.
 */

describe("field labels", () => {
  it("knows the labels a form is full of", () => {
    expect(labelType("FULL NAME")).toBe("PERSON");
    expect(labelType("Email")).toBe("EMAIL");
    expect(labelType("Home Address")).toBe("HOME_ADDRESS");
    expect(labelType("Employer")).toBe("EMPLOYER");
    expect(labelType("API Key")).toBe("API_KEY");
  });

  it("ignores a trailing colon", () => {
    expect(labelType("Phone:")).toBe("PHONE");
    expect(labelType("  Employer  ")).toBe("EMPLOYER");
  });

  it("does not treat an ordinary word as a label", () => {
    expect(labelType("Ada Lovelace")).toBeNull();
    expect(labelType("email me back")).toBeNull();
    expect(labelType("")).toBeNull();
  });

  it("finds the value on the same line as the label", () => {
    const text = "Full Name: Ada Lovelace\nEmail: ada@example.com";
    const start = text.indexOf("Full Name");
    const value = valueAfterLabel(text, start, start + "Full Name".length);

    expect(value).toEqual({ start: 11, end: 23 });
    expect(text.slice(value!.start, value!.end)).toBe("Ada Lovelace");
  });

  it("finds the value on the line below the label", () => {
    const text = "FULL NAME\nAmara Okonkwo\nEMAIL\nada@example.com";
    const start = text.indexOf("FULL NAME");
    const value = valueAfterLabel(text, start, start + "FULL NAME".length);

    expect(text.slice(value!.start, value!.end)).toBe("Amara Okonkwo");
  });

  it("returns nothing when there is no value under the label", () => {
    const text = "FULL NAME\n\nEMAIL\nada@example.com";
    const start = text.indexOf("FULL NAME");
    expect(valueAfterLabel(text, start, start + "FULL NAME".length)).toBeNull();
  });

  it("returns nothing when the label is the last thing in the text", () => {
    const text = "Ada Lovelace\nFULL NAME";
    const start = text.indexOf("FULL NAME");
    expect(valueAfterLabel(text, start, start + "FULL NAME".length)).toBeNull();
  });
});

describe("the values under the labels", () => {
  it("are found without asking a model", () => {
    const form = [
      "FULL NAME",
      "Amara Okonkwo",
      "EMAIL",
      "amara.okonkwo@northwind-labs.io",
      "PHONE",
      "+44 7700 900418",
      "HOME ADDRESS",
      "Flat 12, 88 Cavendish Road, London N12 6QT",
      "EMPLOYER",
      "Northwind Labs",
      "API KEY",
      "sk_live_TESTONLYKEY0000000000000000",
    ].join("\n");

    const values = findLabelValues(form);

    expect(values.map((value) => value.quote)).toEqual([
      "Amara Okonkwo",
      "amara.okonkwo@northwind-labs.io",
      "+44 7700 900418",
      "Flat 12, 88 Cavendish Road, London N12 6QT",
      "Northwind Labs",
      "sk_live_TESTONLYKEY0000000000000000",
    ]);

    expect(values.map((value) => value.type)).toEqual([
      "PERSON",
      "EMAIL",
      "PHONE",
      "HOME_ADDRESS",
      "EMPLOYER",
      "API_KEY",
    ]);

    for (const value of values) {
      expect(form.slice(value.start, value.end)).toBe(value.quote);
    }
  });

  it("are found when the label and the value share a line", () => {
    const form = "Full Name: Amara Okonkwo\nEmail: amara@example.com";
    const values = findLabelValues(form);

    expect(values.map((value) => value.quote)).toEqual([
      "Amara Okonkwo",
      "amara@example.com",
    ]);
  });

  it("are not read out of ordinary prose", () => {
    const text = "Please email me back.\nI will reply soon.";

    expect(findLabelValues(text)).toEqual([]);
  });

  it("stop at the next label", () => {
    const text = "FULL NAME\nEMAIL\namara@example.com";

    expect(findLabelValues(text).map((value) => value.quote)).toEqual([
      "amara@example.com",
    ]);
  });
});
