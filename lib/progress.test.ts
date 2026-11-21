import { describe, expect, it } from "vitest";
import { applyStep, PICTURE_STEPS, TEXT_STEPS } from "./progress";

/**
 * The progress a scrub reports.
 *
 * The bar is only allowed to move when the stage can say how far along it is,
 * so these tests are about which steps exist and how a reported step replaces
 * the one before it, rather than about any timing.
 */

describe("the steps of a text scrub", () => {
  it("has a rules stage and a model stage", () => {
    expect(TEXT_STEPS.map((step) => step.id)).toEqual(["rules", "model"]);
  });

  it("starts with every stage waiting", () => {
    expect(TEXT_STEPS.every((step) => step.status === "pending")).toBe(true);
  });

  it("does not claim a fraction for the stages that cannot give one", () => {
    expect(TEXT_STEPS.every((step) => step.fraction === null)).toBe(true);
  });
});

describe("the steps of a picture scrub", () => {
  it("reads the picture, runs the tiers, then covers the words", () => {
    expect(PICTURE_STEPS.map((step) => step.id)).toEqual([
      "read",
      "rules",
      "model",
      "cover",
    ]);
  });
});

describe("applying a reported step", () => {
  it("puts a stage that was waiting into the running state", () => {
    const next = applyStep(TEXT_STEPS, {
      id: "rules",
      label: "THE RULES",
      status: "running",
      fraction: null,
    });

    expect(next[0].status).toBe("running");
    expect(next[1].status).toBe("pending");
  });

  it("keeps the order the steps were declared in", () => {
    const next = applyStep(TEXT_STEPS, {
      id: "model",
      label: "THE ON-DEVICE MODEL",
      status: "running",
      fraction: null,
    });

    expect(next.map((step) => step.id)).toEqual(["rules", "model"]);
  });

  it("replaces the label when the run moves to the other tier", () => {
    const started = applyStep(TEXT_STEPS, {
      id: "model",
      label: "THE ON-DEVICE MODEL",
      status: "running",
      fraction: null,
    });

    const escalated = applyStep(started, {
      id: "model",
      label: "THE CLOUD MODEL",
      status: "running",
      fraction: null,
    });

    expect(escalated[1].label).toBe("THE CLOUD MODEL");
  });

  it("records the fraction a stage reported", () => {
    const next = applyStep(PICTURE_STEPS, {
      id: "read",
      label: "READING THE PICTURE",
      status: "running",
      fraction: 0.4,
    });

    expect(next[0].fraction).toBe(0.4);
  });

  it("does not change the steps it was given", () => {
    const before = TEXT_STEPS[0].status;
    applyStep(TEXT_STEPS, {
      id: "rules",
      label: "THE RULES",
      status: "running",
      fraction: null,
    });

    expect(TEXT_STEPS[0].status).toBe(before);
  });
});
