"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OutputFormToggle, PurposePicker } from "@/components/scan/context-controls";
import { InferenceBadge } from "@/components/scan/inference-badge";
import { MaskedOutput } from "@/components/scan/masked-output";
import { ModeToggle, modeHint } from "@/components/scan/mode-toggle";
import { ScrubProgress } from "@/components/scan/progress";
import { TurnLabel } from "@/components/scan/turn-label";
import { Textarea } from "@/components/ui/textarea";
import { applyStep, TEXT_STEPS, type ProgressStep } from "@/lib/progress";
import { explainModelError } from "@/lib/errors";
import { probeLeakTest, runLeakTest, type LeakTestResult } from "@/lib/leak-test";
import { purposeSpec } from "@/lib/purpose";
import { createLeakRunner, createModelRunner } from "@/lib/runner";
import type {
  OutputForm,
  Purpose,
  ScanContext,
  ScanMode,
} from "@/lib/types";
import { LeakRow } from "./leak-row";
import { LeakVerdict, type VerdictCaveat } from "./leak-verdict";

const OUTPUT_LABEL: Record<OutputForm, string> = {
  rewritten: "Rewritten",
  token: "Tokens",
};

const MODE_LABEL: Record<ScanMode, string> = {
  auto: "Automatic",
  on_device: "On this device",
  cloud: "In the cloud",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} MS`;
  return `${(ms / 1000).toFixed(1)} S`;
}

/**
 * The proof page.
 *
 * Two stages, and only the first one runs on its own. The scan produces a
 * clean copy; the local checks look at that copy and say whether anything
 * still points back to what was removed. That is arithmetic over strings, so
 * it is instant and it is free.
 *
 * The second stage asks a model to work the redaction backwards, which is the
 * best thing on the site to watch and the one thing that can cost a cloud
 * request. So it sits behind a button, and the page never spends it for you.
 */
export function LeakTestPanel() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ScanMode>("auto");
  const [purpose, setPurpose] = useState<Purpose>("general");
  const [purposeNote, setPurposeNote] = useState("");
  const [outputForm, setOutputForm] = useState<OutputForm>("rewritten");
  const [result, setResult] = useState<LeakTestResult | null>(null);
  const [scannedText, setScannedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(false);
  const [steps, setSteps] = useState<ProgressStep[]>(TEXT_STEPS);
  const [controlsOpen, setControlsOpen] = useState(false);

  const runner = useMemo(() => createModelRunner(), []);
  const leakRunner = useMemo(() => createLeakRunner(), []);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const replyRef = useRef<HTMLElement | null>(null);

  const context = useMemo<ScanContext>(
    () => ({
      purpose,
      purposeNote: purpose === "custom" ? purposeNote : undefined,
      outputForm,
    }),
    [purpose, purposeNote, outputForm]
  );

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;

    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, 320)}px`;
  }, [text]);

  useEffect(() => {
    if (!busy && !result) return;
    const node = replyRef.current;
    if (!node) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({
      behavior: reduce ? "instant" : "smooth",
      block: "start",
    });
  }, [busy, result]);

  async function run() {
    if (busy || !text.trim()) return;

    const scanned = text;
    setBusy(true);
    setSteps(TEXT_STEPS);
    setControlsOpen(false);
    setScannedText(scanned);
    setText("");

    try {
      const next = await runLeakTest(scanned, {
        mode,
        context,
        runner: runner ?? undefined,
        onProgress: (step) => setSteps((previous) => applyStep(previous, step)),
      });

      setResult(next);
    } finally {
      setBusy(false);
    }
  }

  async function probe() {
    if (!result || probing) return;

    setProbing(true);
    try {
      setResult(
        await probeLeakTest(result, {
          mode,
          leakRunner: leakRunner ?? undefined,
        })
      );
    } finally {
      setProbing(false);
    }
  }

  const probeError = result?.probe?.error
    ? explainModelError(result.probe.error)
    : null;

  const scanError = result?.scan.degradedReason
    ? explainModelError(result.scan.degradedReason)
    : null;

  const covered = result
    ? result.scan.findings.filter((finding) => finding.decision === "redact").length
    : 0;

  // A verdict needs something to be a verdict about. If the scan removed
  // nothing, there is no redaction to prove. A scan that did not finish is
  // a different case: the verdict still says what it saw, but it says how
  // far it saw.
  const caveat: VerdictCaveat =
    result && covered === 0 ? "nothing_removed" : "none";

  const partial = Boolean(result?.scan.degradedReason);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-8 pb-8">
        {busy || result ? (
          <>
            <section aria-label="Your text">
              <TurnLabel>YOUR TEXT</TurnLabel>
              <div className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words border border-hairline bg-surface p-4 font-mono text-xs leading-relaxed text-muted [overflow-wrap:anywhere]">
                {scannedText}
              </div>
            </section>

            <section
              ref={replyRef}
              aria-label="The proof"
              className="scroll-mt-24"
            >
              <TurnLabel>PROOF</TurnLabel>

              <div className="mt-3 border border-hairline">
                <div className="mono flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline px-4 py-3">
                  {result && !busy ? (
                    <>
                      <InferenceBadge source={result.scan.inferenceSource} />
                      <span className="text-faint">
                        {result.scan.charsSent.toLocaleString("en-US")} CHARS SENT
                      </span>
                      <span className="text-faint">{covered} COVERED</span>
                      <span className="text-faint">
                        {formatDuration(result.scan.durations.totalMs)}
                      </span>
                    </>
                  ) : (
                    <span className="text-faint">WORKING</span>
                  )}
                </div>

                <div className="p-4 sm:p-5">
                  {busy ? (
                    <ScrubProgress steps={steps} running={busy} />
                  ) : result ? (
                    <>
                      {scanError ? (
                        <p className="mono text-accent">
                          SCAN MODEL TIER · {scanError.label}
                        </p>
                      ) : null}

                      <div className="mt-6 first:mt-0">
                        <LeakVerdict
                          verdict={result.verdict}
                          score={result.score}
                          complete={Boolean(result.probe) && !result.probe?.error}
                          probeRan={Boolean(result.probe)}
                          caveat={caveat}
                          partial={partial}
                        />
                      </div>

                      <h3 className="mono mt-10 text-faint">
                        {result.leaks.length} TRACE
                        {result.leaks.length === 1 ? "" : "S"}
                      </h3>

                      {result.leaks.length > 0 ? (
                        <ul className="mt-2">
                          {result.leaks.map((leak, index) => (
                            <LeakRow
                              key={`${leak.kind}-${index}`}
                              leak={leak}
                            />
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-muted">
                          Nothing in the copy points back to what was removed.
                        </p>
                      )}

                      {result.probe ? (
                        <div className="mono mt-6 text-faint">
                          {result.probe.error
                            ? "THE MODEL ATTACK DID NOT FINISH"
                            : "THE MODEL ATTACKED THE COPY"}{" "}
                          · {result.probe.charsSent.toLocaleString("en-US")} CHARS
                          SENT · {result.probe.tier.replace("_", " ").toUpperCase()}
                        </div>
                      ) : null}

                      {probeError ? (
                        <p className="mono mt-3 text-accent">
                          PROBE · {probeError.label}
                        </p>
                      ) : null}

                      {!result.probe || result.probe.error ? (
                        <div className="mt-10 border-t border-hairline pt-6">
                          <h3 className="mono text-faint">
                            AND CAN A MODEL WORK IT BACK OUT?
                          </h3>
                          <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-muted">
                            The checks above are arithmetic: they look for a
                            distinctive part of a removed value reappearing in
                            the copy. A model can also reason about what a
                            reader could still infer. That is a second model
                            call, so it only happens if you ask for it.
                          </p>
                          <button
                            type="button"
                            onClick={() => void probe()}
                            disabled={probing}
                            className="mono mt-4 inline-flex items-center justify-center border border-accent px-6 py-3 text-accent transition-colors duration-150 hover:bg-accent hover:text-canvas disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {probing
                              ? "ATTACKING THE COPY"
                              : result.probe
                                ? "ATTACK THE COPY AGAIN"
                                : "ATTACK THE COPY"}
                          </button>
                        </div>
                      ) : null}

                      {probeError ? (
                        <p className="mono mt-6 text-accent">
                          PROBE · {probeError.label}
                        </p>
                      ) : null}

                      <div className="mt-10 border-t border-hairline pt-8">
                        <MaskedOutput
                          text={result.cleanCopy}
                          form={result.scan.context.outputForm}
                          note={
                            covered === 0
                              ? "NOTHING WAS REMOVED — THIS IS YOUR TEXT, UNCHANGED"
                              : undefined
                          }
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-20 -mx-[var(--gutter)] border-t border-hairline bg-canvas px-[var(--gutter)] pt-4 pb-5">
        {controlsOpen ? (
          <div className="grid gap-5">
            <PurposePicker
              purpose={purpose}
              onChange={setPurpose}
              note={purposeNote}
              onNoteChange={setPurposeNote}
            />

            <OutputFormToggle value={outputForm} onChange={setOutputForm} />

            <div>
              <ModeToggle value={mode} onChange={setMode} />
              <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-muted">
                {modeHint(mode)}
              </p>
            </div>

            {result ? (
              <button
                type="button"
                onClick={() => setControlsOpen(false)}
                className="mono justify-self-start text-muted transition-colors duration-150 hover:text-accent"
              >
                HIDE THESE
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setControlsOpen(true)}
            aria-label={`Settings: purpose ${purposeSpec(purpose).label}, output ${OUTPUT_LABEL[outputForm]}, tier ${MODE_LABEL[mode]}. Change them.`}
            className="mono flex w-full items-center justify-between gap-3 text-faint transition-colors duration-150 hover:text-accent"
          >
            <span>
              <span className="text-faint">SETTINGS</span> ·{" "}
              {purposeSpec(purpose).label} · {OUTPUT_LABEL[outputForm]} ·{" "}
              {MODE_LABEL[mode]}
            </span>
            <span className="shrink-0 text-accent">CHANGE</span>
          </button>
        )}

        <Textarea
          ref={textareaRef}
          id="source"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            if (event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            void run();
          }}
          placeholder="Paste the text you want to check."
          rows={2}
          spellCheck={false}
          className="mt-3 min-h-[5rem] bg-surface"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="mono text-faint">
            ENTER TO CHECK
            <span className="hidden sm:inline">
              {" "}
              · SHIFT+ENTER FOR A NEW LINE
            </span>
          </span>

          <button
            type="button"
            onClick={() => void run()}
            disabled={busy || !text.trim()}
            className="mono inline-flex w-full items-center justify-center bg-accent px-6 py-3 text-canvas transition-colors duration-150 hover:bg-[#ff6237] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {busy ? "CHECKING" : "CHECK IT"}
          </button>
        </div>
      </div>
    </div>
  );
}
