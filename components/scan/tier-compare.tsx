"use client";

import { useState } from "react";
import { explainModelError } from "@/lib/errors";
import type { ModelRunner } from "@/lib/model";
import { findingsMissingFrom } from "@/lib/offsets";
import {
  applyStep,
  type ProgressReporter,
  type ProgressStep,
} from "@/lib/progress";
import { scrub } from "@/lib/scrub";
import type { ScanContext, ScanResult } from "@/lib/types";
import { FindingRow } from "./finding-row";
import { ScrubProgress } from "./progress";

/**
 * The two tiers, side by side.
 *
 * The on-device model is the cheaper and the private one, and it is also a
 * small model that misses things. The cloud model is the thorough one, and
 * it costs a request and sends the text away. Neither is better on its own,
 * so the app shows what the other one would have added rather than arguing
 * for a winner.
 *
 * The comparison is never automatic. A cloud request is a real request, and
 * the free tier is twenty a day, so the user asks for it.
 */
export function TierCompare({
  text,
  context,
  device,
  runner,
}: {
  text: string;
  context: ScanContext;
  device: ScanResult;
  runner: ModelRunner | null;
}) {
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [cloud, setCloud] = useState<ScanResult | null>(null);
  const [running, setRunning] = useState(false);

  // There is nothing to compare against when the run was already in the
  // cloud: the device never saw the text.
  if (device.inferenceSource !== "ON_DEVICE") {
    return (
      <p className="mono text-faint">
        THE DEVICE NEVER SAW THIS TEXT, SO THERE IS NOTHING TO COMPARE IT
        AGAINST
      </p>
    );
  }

  if (!runner) {
    return (
      <p className="mono text-faint">
        NO MODEL TIER, SO NO SECOND RUN TO COMPARE AGAINST
      </p>
    );
  }

  const report: ProgressReporter = (step) => {
    setSteps((previous) => applyStep(previous, step));
  };

  async function compare() {
    setRunning(true);
    setCloud(null);

    try {
      const result = await scrub(text, {
        mode: "cloud",
        runner: runner ?? undefined,
        context,
        onProgress: report,
      });
      setCloud(result);
    } finally {
      setRunning(false);
    }
  }

  const extra = cloud ? findingsMissingFrom(cloud.findings, device.findings) : [];
  const error = cloud?.degradedReason
    ? explainModelError(cloud.degradedReason)
    : null;

  return (
    <div>
      {cloud ? null : (
        <button
          type="button"
          onClick={compare}
          disabled={running}
          className="mono border border-hairline px-4 py-2 text-muted transition-colors duration-150 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? "ASKING" : "ASK THE CLOUD TOO"}
        </button>
      )}

      {cloud ? null : (
        <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-muted">
          Runs the same text through the cloud model so you can see what the
          device missed, and what that costs. It sends the text to Google and
          uses one of the twenty free requests a day.
        </p>
      )}

      {running ? (
        <div className="mt-4">
          <ScrubProgress steps={steps} running={running} />
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 border-l border-accent pl-4">
          <p className="mono text-accent">{error.label}</p>
          <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-muted">
            The cloud run did not finish, so there is nothing to compare. The
            on-device result below still stands.
          </p>
        </div>
      ) : null}

      {cloud && !error ? (
        <div className="mt-4">
          <p className="mono text-accent">
            {extra.length > 0
              ? `THE CLOUD ADDED ${extra.length}`
              : "THE CLOUD FOUND NOTHING THE DEVICE MISSED"}
          </p>

          {extra.length > 0 ? (
            <ul className="mt-3">
              {extra.map((finding, index) => (
                <FindingRow
                  key={`${finding.type}-${finding.start}-${index}`}
                  finding={finding}
                />
              ))}
            </ul>
          ) : null}

          <p className="mono mt-4 text-faint">
            {cloud.charsSent.toLocaleString("en-US")} CHARS SENT TO GOOGLE ·{" "}
            {cloud.durations.totalMs >= 1000
              ? `${(cloud.durations.totalMs / 1000).toFixed(1)} S`
              : `${cloud.durations.totalMs} MS`}
          </p>

          <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-muted">
            {extra.length > 0
              ? "The device would have missed these. Whether that is worth sending the text away is your call."
              : "You paid for the request and it found nothing the device had not. The device is usually enough."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
