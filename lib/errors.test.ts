import { describe, expect, it } from "vitest";
import { explainModelError } from "./errors";

/**
 * The model tier's raw errors are long, and they arrive as prose with a JSON
 * blob on the end. These tests pin the classification, because the message
 * the user reads is the only thing standing between them and a wall of
 * stack-trace-looking text.
 */

const QUOTA_ERROR =
  "AI: Error fetching from https://firebasevertexai.googleapis.com/v1beta/projects/redact-fdd1a/models/gemini-3.8-flash:generateContent: " +
  "[429 ] You exceeded your current quota, please check your plan and billing details. " +
  "* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash. " +
  "Please retry in 15h5m44.61294071s. " +
  '[{"@type":"type.googleapis.com/google.rpc.QuotaFailure"}] (AI/fetch-error)';

describe("explainModelError", () => {
  it("reads a quota failure as a quota failure", () => {
    const error = explainModelError(QUOTA_ERROR);

    expect(error.code).toBe("QUOTA");
    expect(error.label).toBe("QUOTA EXCEEDED");
    expect(error.title).not.toContain("quota exceeded for metric");
  });

  it("tells the user when the quota resets", () => {
    expect(explainModelError(QUOTA_ERROR).retryHint).toBe(
      "The quota resets in about 15 hours."
    );
  });

  it("does not mistake the generic fetch wrapper for a network failure", () => {
    // Every cloud error is wrapped in "Error fetching from ...", so that
    // phrase cannot be the thing that means the network is down.
    expect(explainModelError(QUOTA_ERROR).code).not.toBe("NETWORK");
  });

  it("reads an App Check rejection", () => {
    const error = explainModelError(
      "Firebase App Check token is invalid."
    );

    expect(error.code).toBe("APP_CHECK");
  });

  it("reads a dropped connection", () => {
    expect(explainModelError("TypeError: Failed to fetch").code).toBe("NETWORK");
  });

  it("reads an on-device model that is not ready", () => {
    expect(
      explainModelError("User activation failed: no on-device model available")
        .code
    ).toBe("MODEL_UNAVAILABLE");
  });

  it("falls back to a plain message for anything it does not know", () => {
    const error = explainModelError("something nobody has seen before");

    expect(error.code).toBe("UNKNOWN");
    expect(error.title.length).toBeGreaterThan(0);
  });

  it("always keeps the raw message for the disclosure", () => {
    expect(explainModelError(QUOTA_ERROR).raw).toBe(QUOTA_ERROR);
  });

  it("always says that a degraded scan is a partial scrub", () => {
    // This is the line that stops a user trusting a pattern-only result as
    // if the model had looked at their text.
    for (const raw of [QUOTA_ERROR, "something nobody has seen before"]) {
      expect(explainModelError(raw).detail).toMatch(/pattern rules|partial scrub/i);
    }
  });
});
