"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { explainModelError } from "@/lib/errors";
import { maskText } from "@/lib/offsets";
import { createModelRunner } from "@/lib/runner";
import { scrub } from "@/lib/scrub";
import type { ScanMode, ScanResult } from "@/lib/types";
import { EscalationNotice } from "./escalation-notice";
import { FindingRow } from "./finding-row";
import { InferenceBadge } from "./inference-badge";
import { MaskedOutput } from "./masked-output";
import { ModeToggle, modeHint } from "./mode-toggle";
import { ModelTierNotice } from "./model-tier-notice";
import { PrivacyMeter } from "./privacy-meter";
import { ReceiptPanel } from "./receipt-panel";

export function ScanPanel() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ScanMode>("auto");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);

  const runner = useMemo(() => createModelRunner(), []);
  const resultsRef = useRef<HTMLElement | null>(null);

  const masked = useMemo(
    () => (result ? maskText(text, result.findings) : ""),
    [result, text]
  );

  const modelError = useMemo(
    () =>
      result?.degradedReason ? explainModelError(result.degradedReason) : null,
    [result]
  );

  // On a phone the result lands well below the fold. Bring it into view, so
  // the scan does not look like it did nothing.
  useEffect(() => {
    if (!result) return;
    const node = resultsRef.current;
    if (!node) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({
      behavior: reduce ? "instant" : "smooth",
      block: "start",
    });
  }, [result]);

  async function run() {
    setBusy(true);
    try {
      setResult(await scrub(text, { mode, runner: runner ?? undefined }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
      <div className="min-w-0">
        <label htmlFor="source" className="mono block text-faint">
          TEXT TO SCRUB
        </label>
        <Textarea
          id="source"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste the text you are about to send to an assistant."
          rows={12}
          spellCheck={false}
          className="mt-3 h-44 bg-surface sm:h-auto"
        />

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <ModeToggle value={mode} onChange={setMode} />

          <button
            type="button"
            onClick={run}
            disabled={busy || !text.trim()}
            className="inline-flex w-full items-center justify-center bg-accent px-7 py-3 text-sm text-canvas transition-colors duration-150 hover:bg-[#ff6237] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {busy ? "Scanning" : "Scan"}
          </button>
        </div>

        <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-muted">
          {modeHint(mode)}
        </p>

        {!runner ? (
          <p className="mono mt-5 text-faint">
            MODEL TIER OFFLINE · PATTERNS ONLY
          </p>
        ) : null}

        {result ? (
          <section
            ref={resultsRef}
            className="mt-8 scroll-mt-24 sm:mt-12"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <InferenceBadge source={result.inferenceSource} />
              <PrivacyMeter result={result} />
            </div>

            {modelError ? (
              <div className="mt-6">
                <ModelTierNotice error={modelError} />
              </div>
            ) : null}

            {result.escalated ? (
              <div className="mt-6">
                <EscalationNotice reason="The text was larger than the on-device model can hold, so it was sent to the cloud model instead." />
              </div>
            ) : null}

            <h2 className="mono mt-8 text-faint sm:mt-10">
              {result.findings.length} FINDING
              {result.findings.length === 1 ? "" : "S"}
            </h2>

            {result.findings.length > 0 ? (
              <ul className="mt-3">
                {result.findings.map((finding, index) => (
                  <FindingRow
                    key={`${finding.type}-${finding.start}-${index}`}
                    finding={finding}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-muted">Nothing sensitive was found.</p>
            )}

            <div className="mt-8 sm:mt-12">
              <MaskedOutput text={masked} />
            </div>
          </section>
        ) : null}
      </div>

      <aside className="min-w-0 lg:pt-1">
        {result ? <ReceiptPanel result={result} /> : null}
      </aside>
    </div>
  );
}
