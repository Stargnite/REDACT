"use client";

import { useEffect, useState } from "react";
import type { ProgressStep } from "@/lib/progress";

/**
 * The progress of a scrub.
 *
 * Every stage the pipeline reports gets a line, and the stage that is running
 * gets a bar. When the stage can say how far along it is, the bar fills. When
 * it cannot — a model call is one opaque request, and there is nothing true to
 * report about it — the bar slides, and the clock says how long it has been
 * waiting. A bar that moved on its own would be a lie about work that is not
 * happening.
 */
export function ScrubProgress({
  steps,
  running,
}: {
  steps: ProgressStep[];
  running: boolean;
}) {
  const elapsed = useElapsed(running);

  if (!steps.length) return null;

  return (
    <div className="mono" role="status" aria-live="polite">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-3 py-1.5">
          <span aria-hidden className={marker(step.status)} />
          <span className={label(step.status)}>{step.label}</span>
          {step.status === "running" ? (
            <>
              <Bar fraction={step.fraction} />
              <span className="shrink-0 text-faint">{elapsed}</span>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function marker(status: ProgressStep["status"]): string {
  if (status === "done") return "h-1.5 w-1.5 shrink-0 bg-accent";
  if (status === "running") return "h-1.5 w-1.5 shrink-0 animate-pulse bg-accent";
  return "h-1.5 w-1.5 shrink-0 border border-hairline";
}

function label(status: ProgressStep["status"]): string {
  if (status === "running") return "text-text";
  if (status === "done") return "text-muted";
  return "text-faint opacity-40";
}

function Bar({ fraction }: { fraction: number | null }) {
  const percent =
    fraction === null ? null : Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      className="relative h-px flex-1 overflow-hidden bg-hairline"
    >
      {percent === null ? (
        <span
          className="absolute inset-y-0 left-0 w-1/4 bg-accent"
          style={{
            animation: "scrub-slide 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite",
          }}
        />
      ) : (
        <span
          className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
      )}
    </div>
  );
}

/**
 * How long the run has been going.
 *
 * The clock is the honest part of the wait: a model that takes a minute is
 * slow, and a user who can see that knows to wait rather than to give up.
 */
function useElapsed(running: boolean): string {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    if (!running) {
      setMs(0);
      return;
    }

    const startedAt = Date.now();
    const timer = setInterval(() => setMs(Date.now() - startedAt), 100);

    return () => clearInterval(timer);
  }, [running]);

  return `${(ms / 1000).toFixed(1)} S`;
}
