"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OutputFormToggle, PurposePicker } from "@/components/scan/context-controls";
import { MaskedOutput } from "@/components/scan/masked-output";
import { ModeToggle, modeHint } from "@/components/scan/mode-toggle";
import { Hairline, SectionLabel } from "@/components/site/section-label";
import { Textarea } from "@/components/ui/textarea";
import { runLeakTest, type LeakTestResult } from "@/lib/leak-test";
import { explainModelError } from "@/lib/errors";
import { purposeSpec } from "@/lib/purpose";
import { createLeakRunner, createModelRunner } from "@/lib/runner";
import type {
  OutputForm,
  Purpose,
  ScanContext,
  ScanMode,
} from "@/lib/types";
import { LeakRow } from "./leak-row";
import { LeakVerdict } from "./leak-verdict";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} MS`;
  return `${(ms / 1000).toFixed(1)} S`;
}

export function LeakTestPanel() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ScanMode>("auto");
  const [purpose, setPurpose] = useState<Purpose>("general");
  const [purposeNote, setPurposeNote] = useState("");
  const [outputForm, setOutputForm] = useState<OutputForm>("rewritten");
  const [result, setResult] = useState<LeakTestResult | null>(null);
  const [busy, setBusy] = useState(false);

  const runner = useMemo(() => createModelRunner(), []);
  const leakRunner = useMemo(() => createLeakRunner(), []);
  const resultsRef = useRef<HTMLElement | null>(null);

  const context = useMemo<ScanContext>(
    () => ({
      purpose,
      purposeNote: purpose === "custom" ? purposeNote : undefined,
      outputForm,
    }),
    [purpose, purposeNote, outputForm]
  );

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
      setResult(
        await runLeakTest(text, {
          mode,
          context,
          runner: runner ?? undefined,
          leakRunner: leakRunner ?? undefined,
        })
      );
    } finally {
      setBusy(false);
    }
  }

  const probeError = result?.probe?.error
    ? explainModelError(result.probe.error)
    : null;

  const scanError = result?.scan.degradedReason
    ? explainModelError(result.scan.degradedReason)
    : null;

  const rows: [string, string][] = result
    ? [
        ["PURPOSE", purposeSpec(result.scan.context.purpose).label],
        [
          "OUTPUT",
          result.scan.context.outputForm === "rewritten" ? "REWRITTEN" : "TOKENS",
        ],
        ["SCAN TIER", result.scan.inferenceSource.replace(/_/g, " ")],
        [
          "PROBE",
          result.probe
            ? `${result.probe.tier.replace(/_/g, " ")}${result.probe.error ? " · FAILED" : ""}`
            : "NOT RUN",
        ],
        ["CHARS SENT", String(result.probe?.charsSent ?? 0)],
        ["FINDINGS", String(result.scan.findings.length)],
        ["LEAKS", String(result.leaks.length)],
        ["SCAN TIME", formatDuration(result.scan.durations.totalMs)],
      ]
    : [];

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
      <div className="min-w-0">
        <PurposePicker
          purpose={purpose}
          onChange={setPurpose}
          note={purposeNote}
          onNoteChange={setPurposeNote}
        />

        <div className="mt-8">
          <OutputFormToggle value={outputForm} onChange={setOutputForm} />
        </div>

        <label htmlFor="leak-source" className="mono mt-8 block text-faint">
          TEXT TO TEST
        </label>
        <Textarea
          id="leak-source"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste the text you want to check, or the clean copy you already have."
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
            {busy ? "Testing" : "Run the leak test"}
          </button>
        </div>

        <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-muted">
          {modeHint(mode)}
        </p>

        <p className="mono mt-5 text-faint">
          THE PROBE ONLY EVER SEES THE CLEAN COPY
        </p>

        {result ? (
          <section
            ref={resultsRef}
            className="mt-8 scroll-mt-24 sm:mt-12"
            aria-live="polite"
          >
            <LeakVerdict
              verdict={result.verdict}
              score={result.score}
              complete={Boolean(result.probe) && !result.probe?.error}
            />

            {probeError ? (
              <p className="mono mt-6 text-accent">
                PROBE · {probeError.label}
              </p>
            ) : null}

            {scanError ? (
              <p className="mono mt-3 text-accent">
                SCAN MODEL TIER · {scanError.label}
              </p>
            ) : null}

            <h2 className="mono mt-8 text-faint sm:mt-10">
              {result.leaks.length} LEAK{result.leaks.length === 1 ? "" : "S"}
            </h2>

            {result.leaks.length > 0 ? (
              <ul className="mt-3">
                {result.leaks.map((leak, index) => (
                  <LeakRow key={`${leak.kind}-${index}`} leak={leak} />
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-muted">
                Nothing in the copy points back to what was removed.
              </p>
            )}

            <div className="mt-8 sm:mt-12">
              <MaskedOutput
                text={result.cleanCopy}
                form={result.scan.context.outputForm}
              />
            </div>
          </section>
        ) : null}
      </div>

      <aside className="min-w-0 lg:pt-1">
        {result ? (
          <div>
            <SectionLabel index="RECEIPT">This run</SectionLabel>
            <Hairline className="mt-5" />

            <dl className="mono mt-1">
              {rows.map(([term, value]) => (
                <div
                  key={term}
                  className="flex items-baseline justify-between gap-4 border-b border-hairline py-3"
                >
                  <dt className="shrink-0 text-faint">{term}</dt>
                  <dd className="min-w-0 break-words text-right text-text">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
