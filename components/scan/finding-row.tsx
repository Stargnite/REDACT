"use client";

import { useState } from "react";
import type { Finding, Severity } from "@/lib/types";

/**
 * Type is carried by the label and the underline treatment. Hue never
 * carries type, so the list stays legible in greyscale and to a
 * colour-blind reader, and the accent rationing survives.
 */
const DECORATION: Record<Severity, { style: string; thickness: string }> = {
  critical: { style: "solid", thickness: "2px" },
  high: { style: "dashed", thickness: "2px" },
  low: { style: "dotted", thickness: "1px" },
};

export function FindingRow({ finding }: { finding: Finding }) {
  const [masked, setMasked] = useState(true);
  const decoration = DECORATION[finding.severity];
  const kept = finding.decision === "retain";

  return (
    <li className="border-b border-hairline py-5 transition-colors duration-150 hover:bg-[rgba(255,74,28,0.1)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="mono text-faint">{finding.label}</span>
        <span className="mono text-faint">
          {kept ? "KEPT · " : ""}
          {finding.source === "pattern" ? "PATTERN" : "MODEL"}
        </span>
      </div>

      <p className="mt-2 break-words text-text">
        {kept ? (
          <span className="mono text-muted">{finding.quote}</span>
        ) : masked ? (
          <span className="mono text-muted">
            {finding.replacement ?? `[REDACTED:${finding.type}]`}
          </span>
        ) : (
          <span
            style={{
              textDecorationLine: decoration.style,
              textDecorationThickness: decoration.thickness,
              textUnderlineOffset: "3px",
              textDecorationColor: "var(--color-accent)",
            }}
          >
            {finding.quote}
          </span>
        )}
      </p>

      {finding.reason ? (
        <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted">
          {finding.reason}
        </p>
      ) : null}

      {kept ? null : (
        <button
          type="button"
          onClick={() => setMasked((previous) => !previous)}
          className="mono mt-3 text-muted transition-colors duration-150 hover:text-accent"
        >
          {masked ? "Show the match" : "Hide the match"}
        </button>
      )}
    </li>
  );
}
