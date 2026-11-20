"use client";

import { useState } from "react";
import type { Leak } from "@/lib/leak-test";

const KIND: Record<Leak["kind"], string> = {
  residual_token: "RESIDUAL",
  pattern_reintroduced: "REINTRODUCED",
  inference: "INFERENCE",
};

const SEVERITY: Record<Leak["severity"], string> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

/**
 * One leak.
 *
 * The citation is the part of the clean copy that carries the leak, and it is
 * always shown: a leak you cannot see is not actionable. The evidence is the
 * matching text, and it stays behind a toggle because it is the only thing
 * here that comes close to the original.
 */
export function LeakRow({ leak }: { leak: Leak }) {
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <li className="border-b border-hairline py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="mono text-faint">{KIND[leak.kind]}</span>
        <span className="mono text-faint">{SEVERITY[leak.severity]}</span>
      </div>

      <p className="mt-2 text-text">{leak.detail}</p>

      {leak.citation ? (
        <p className="mono mt-3 break-words border-l border-accent pl-3 text-sm text-muted">
          {leak.citation}
        </p>
      ) : null}

      {leak.evidence ? (
        <>
          <button
            type="button"
            onClick={() => setShowEvidence((previous) => !previous)}
            className="mono mt-3 text-muted transition-colors duration-150 hover:text-accent"
          >
            {showEvidence ? "Hide the evidence" : "Show the evidence"}
          </button>

          {showEvidence ? (
            <p className="mono mt-3 break-words text-sm text-faint">
              {leak.evidence}
            </p>
          ) : null}
        </>
      ) : null}
    </li>
  );
}
