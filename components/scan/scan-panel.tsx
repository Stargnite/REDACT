"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { explainModelError } from "@/lib/errors";
import { applyStep, TEXT_STEPS, type ProgressStep } from "@/lib/progress";
import { purposeSpec } from "@/lib/purpose";
import { createModelRunner } from "@/lib/runner";
import { scrub } from "@/lib/scrub";
import { applyOutput } from "@/lib/rewrite";
import type {
  OutputForm,
  Purpose,
  ScanContext,
  ScanMode,
  ScanResult,
} from "@/lib/types";
import { OutputFormToggle, PurposePicker } from "./context-controls";
import { EscalationNotice } from "./escalation-notice";
import { FindingRow } from "./finding-row";
import { InferenceBadge } from "./inference-badge";
import { MaskedOutput } from "./masked-output";
import { ModeToggle, modeHint } from "./mode-toggle";
import { ModelTierNotice } from "./model-tier-notice";
import { ScrubProgress } from "./progress";
import { TierCompare } from "./tier-compare";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} MS`;
  return `${(ms / 1000).toFixed(1)} S`;
}

const OUTPUT_LABEL: Record<OutputForm, string> = {
  rewritten: "Rewritten",
  token: "Tokens",
};

const MODE_LABEL: Record<ScanMode, string> = {
  auto: "Automatic",
  on_device: "On this device",
  cloud: "In the cloud",
};

/**
 * The scrub, shaped like a conversation.
 *
 * One turn from the user, one turn from the machine, and a composer that
 * stays under your hands. No avatars, no typing dots, no history, no
 * streaming: a chat metaphor that streams words while a small model takes a
 * minute to answer is a chat metaphor that reads as a hang. What the reply
 * carries instead is the black-barred document, the receipt strip, and the
 * second tier, which is the thing that actually distinguishes this from
 * another chatbot on the same platform.
 */
export function ScanPanel() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ScanMode>("auto");
  const [purpose, setPurpose] = useState<Purpose>("general");
  const [purposeNote, setPurposeNote] = useState("");
  const [outputForm, setOutputForm] = useState<OutputForm>("rewritten");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scannedText, setScannedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<ProgressStep[]>(TEXT_STEPS);
  const [controlsOpen, setControlsOpen] = useState(false);

  const runner = useMemo(() => createModelRunner(), []);
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

  // The clean copy is written from the context the scan actually ran under,
  // and from the text that was actually scanned, so the reply can never show
  // a copy the model never produced.
  const masked = useMemo(
    () =>
      result
        ? applyOutput(scannedText, result.findings, result.context.outputForm)
        : "",
    [result, scannedText]
  );

  // Changing the purpose or the output form after a scan makes the result
  // stale. Say so rather than quietly showing the old answer.
  const stale = useMemo(() => {
    if (!result) return false;
    return (
      result.context.purpose !== context.purpose ||
      result.context.outputForm !== context.outputForm ||
      (result.context.purposeNote ?? "") !== (context.purposeNote ?? "")
    );
  }, [result, context]);

  const modelError = useMemo(
    () =>
      result?.degradedReason ? explainModelError(result.degradedReason) : null,
    [result]
  );

  // The composer grows with what is written into it, up to a point, so a
  // long paste is readable while it is being written and the composer does
  // not eat the screen.
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;

    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, 320)}px`;
  }, [text]);

  // The reply lands below the fold on a phone. Bring it into view, so the
  // scan does not look like it did nothing.
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

    // The composer empties the moment the scrub starts, the way a chat box
    // does once you have sent something. The text is not lost: it is kept in
    // the turn above the reply, which is where you would look for it.
    setScannedText(scanned);
    setText("");

    // The controls close the moment the scrub starts. They are the settings
    // for this run, and a run that is already under way cannot use them, so
    // leaving them open would only put a wall of radio buttons between the
    // user and the progress of the thing they asked for.
    setControlsOpen(false);

    try {
      const next = await scrub(scanned, {
        mode,
        runner: runner ?? undefined,
        context,
        onProgress: (step) => setSteps((previous) => applyStep(previous, step)),
      });

      setScannedText(scanned);
      setResult(next);
    } finally {
      setBusy(false);
    }
  }

  const covered = result
    ? result.findings.filter((finding) => finding.decision === "redact").length
    : 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-8 pb-8">
        {busy || result ? (
          <>
            <section aria-label="Your text">
              <TurnLabel>YOUR TEXT</TurnLabel>
              <div className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words border border-hairline bg-surface p-4 font-mono text-xs leading-relaxed text-muted [overflow-wrap:anywhere]">
                {scannedText || text}
              </div>
            </section>

            <section
              ref={replyRef}
              aria-label="The scrubbed result"
              className="scroll-mt-24"
            >
              <TurnLabel>REDACT</TurnLabel>

              <div className="mt-3 border border-hairline">
                <div className="mono flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline px-4 py-3">
                  {result && !busy ? (
                    <>
                      <InferenceBadge source={result.inferenceSource} />
                      <span className="text-faint">
                        {result.charsSent.toLocaleString("en-US")} CHARS SENT
                      </span>
                      <span className="text-faint">{covered} COVERED</span>
                      <span className="text-faint">
                        {formatDuration(result.durations.totalMs)}
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
                      {modelError ? <ModelTierNotice error={modelError} /> : null}

                      {result.unmatchedCount ? (
                        <div className="mt-4">
                          <EscalationNotice
                            reason={`The model reported ${result.unmatchedCount} span${result.unmatchedCount === 1 ? "" : "s"} that could not be matched to the text, so ${result.unmatchedCount === 1 ? "it is" : "they are"} still uncovered. Treat this scrub as partial.`}
                          />
                        </div>
                      ) : null}

                      {result.escalated ? (
                        <div className="mt-4">
                          <EscalationNotice reason="The text was larger than the on-device model can hold, so it was sent to the cloud model instead." />
                        </div>
                      ) : null}

                      {stale ? (
                        <p className="mono mt-4 text-accent">
                          CONTEXT CHANGED · SCRUB AGAIN TO APPLY IT
                        </p>
                      ) : null}

                      <div className="mt-8 first:mt-0">
                        <MaskedOutput
                          text={masked}
                          form={result.context.outputForm}
                        />
                      </div>

                      <h3 className="mono mt-10 text-faint">
                        WHAT WAS FOUND · {result.findings.length} SPAN
                        {result.findings.length === 1 ? "" : "S"}
                        {result.retainedCount > 0
                          ? ` · ${result.retainedCount} KEPT ON PURPOSE`
                          : ""}
                      </h3>

                      {result.findings.length > 0 ? (
                        <ul className="mt-2">
                          {result.findings.map((finding, index) => (
                            <FindingRow
                              key={`${finding.type}-${finding.start}-${index}`}
                              finding={finding}
                            />
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-muted">
                          Nothing sensitive was found.
                        </p>
                      )}

                      <div className="mt-8 border-t border-hairline pt-6">
                        <h3 className="mono text-faint">AND THE OTHER TIER?</h3>
                        <div className="mt-3">
                          <TierCompare
                            text={scannedText}
                            context={result.context}
                            device={result}
                            runner={runner}
                          />
                        </div>
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
          placeholder="Paste the text here."
          rows={2}
          spellCheck={false}
          className="mt-3 min-h-[5rem] bg-surface"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="mono text-faint">
            ENTER TO SCRUB
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
            {busy ? "SCRUBBING" : "SCRUB"}
          </button>
        </div>

        {!runner ? (
          <p className="mono mt-4 text-faint">
            MODEL TIER OFFLINE · PATTERNS ONLY
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The name of a turn.
 *
 * A hairline square rather than an avatar: an avatar says "a person and a
 * robot are talking", and this is not a person and a robot. It is a scrub.
 */
function TurnLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mono flex items-center gap-3 text-faint">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 border border-hairline" />
      {children}
    </span>
  );
}
