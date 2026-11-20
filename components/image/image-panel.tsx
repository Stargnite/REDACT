"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PurposePicker } from "@/components/scan/context-controls";
import { ModeToggle, modeHint } from "@/components/scan/mode-toggle";
import { Hairline, SectionLabel } from "@/components/site/section-label";
import { explainModelError } from "@/lib/errors";
import { scrubImage, type ImageScrubResult } from "@/lib/image-scrub";
import { purposeSpec } from "@/lib/purpose";
import { createImageRunner } from "@/lib/runner";
import type { Purpose, ScanContext, ScanMode } from "@/lib/types";
import { RegionRow } from "./region-row";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} MS`;
  return `${(ms / 1000).toFixed(1)} S`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPTED = "image/png,image/jpeg,image/webp";

export function ImagePanel() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ScanMode>("auto");
  const [purpose, setPurpose] = useState<Purpose>("general");
  const [purposeNote, setPurposeNote] = useState("");
  const [result, setResult] = useState<ImageScrubResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  const runner = useMemo(() => createImageRunner(), []);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);

  const context = useMemo<ScanContext>(
    () => ({
      purpose,
      purposeNote: purpose === "custom" ? purposeNote : undefined,
      outputForm: "token",
    }),
    [purpose, purposeNote]
  );

  // The preview is an object URL, so it has to be released when it is
  // replaced. A leaked object URL keeps the whole picture in memory for the
  // life of the tab.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!result?.output) {
      setOutputUrl(null);
      return;
    }
    const url = URL.createObjectURL(result.output);
    setOutputUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

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

  const accept = useCallback((next: File | null) => {
    setRejected(null);
    setResult(null);

    if (!next) return;

    if (!next.type.startsWith("image/")) {
      setRejected("That file is not a picture.");
      return;
    }

    setFile(next);
  }, []);

  async function run() {
    if (!file) return;

    setBusy(true);
    try {
      setResult(await scrubImage(file, { mode, context, runner: runner ?? undefined }));
    } finally {
      setBusy(false);
    }
  }

  const modelError = result?.error ? explainModelError(result.error) : null;

  const rows: [string, string][] = result
    ? [
        ["PURPOSE", purposeSpec(result.context.purpose).label],
        [
          "TIER",
          result.source === "none"
            ? "NOT RUN"
            : result.source === "on_device"
              ? "ON DEVICE"
              : "IN CLOUD",
        ],
        ["REGIONS", String(result.regions.length)],
        ["IMAGE", `${result.width} x ${result.height}`],
        ["SENT", result.bytesSent === 0 ? "NOTHING" : formatBytes(result.bytesSent)],
        ["TIME", formatDuration(result.durationMs)],
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

        <label htmlFor="picture" className="mono mt-8 block text-faint">
          PICTURE TO SCRUB
        </label>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            accept(event.dataTransfer.files?.[0] ?? null);
          }}
          className={
            dragging
              ? "mt-3 border border-accent bg-surface p-8 text-center"
              : "mt-3 border border-hairline bg-surface p-8 text-center"
          }
        >
          <input
            ref={inputRef}
            id="picture"
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            onChange={(event) => accept(event.target.files?.[0] ?? null)}
          />

          {previewUrl ? (
            <div>
              {/* The original, shown so the user can check it is the picture
                  they meant to pick. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="The picture you picked, before scrubbing"
                className="mx-auto max-h-[26rem] border border-hairline object-contain"
              />
              <p className="mono mt-3 text-faint">{file?.name}</p>
              <button
                type="button"
                onClick={() => {
                  accept(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="mono mt-2 text-muted transition-colors duration-150 hover:text-accent"
              >
                Choose another
              </button>
            </div>
          ) : (
            <div>
              <p className="text-muted">
                Drop a screenshot here, or choose one from your machine.
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mono mt-4 border border-hairline px-4 py-2 text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
              >
                Choose a picture
              </button>
            </div>
          )}
        </div>

        {rejected ? <p className="mono mt-4 text-accent">{rejected}</p> : null}

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <ModeToggle value={mode} onChange={setMode} subject="picture" />

          <button
            type="button"
            onClick={run}
            disabled={busy || !file}
            className="inline-flex w-full items-center justify-center bg-accent px-7 py-3 text-sm text-canvas transition-colors duration-150 hover:bg-[#ff6237] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {busy ? "Scrubbing" : "Scrub the picture"}
          </button>
        </div>

        <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-muted">
          {modeHint(mode, "picture")}
        </p>

        {!runner ? (
          <p className="mono mt-5 text-faint">MODEL TIER OFFLINE</p>
        ) : null}

        {result ? (
          <section
            ref={resultsRef}
            className="mt-8 scroll-mt-24 sm:mt-12"
            aria-live="polite"
          >
            {modelError ? (
              <p className="mono text-accent">MODEL TIER · {modelError.label}</p>
            ) : null}

            {result.escalated ? (
              <p className="mt-4 border-l border-hairline pl-4 text-muted">
                <span className="mono block text-faint">ESCALATED</span>
                <span className="mt-1 block text-sm">
                  The on-device model could not read the picture, so it was sent
                  to the cloud model instead. That is the moment the picture
                  left your machine.
                </span>
              </p>
            ) : null}

            <h2 className="mono mt-8 text-faint sm:mt-10">
              {result.regions.length} REGION{result.regions.length === 1 ? "" : "S"}
            </h2>

            {result.regions.length > 0 ? (
              <ul className="mt-3">
                {result.regions.map((region, index) => (
                  <RegionRow key={`${region.type}-${index}`} region={region} index={index} />
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-muted">
                {modelError
                  ? "Nothing could be checked."
                  : "Nothing sensitive was found in the picture."}
              </p>
            )}

            {outputUrl ? (
              <div className="mt-8 sm:mt-12">
                <h3 className="mono text-faint">SCRUBBED PICTURE</h3>
                <Hairline className="mt-5" />

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={outputUrl}
                  alt="The picture with its sensitive regions covered"
                  className="mt-5 max-h-[32rem] w-full border border-hairline object-contain"
                />

                <a
                  href={outputUrl}
                  download="scrubbed.png"
                  className="mono mt-5 inline-flex items-center border border-accent px-5 py-3 text-accent transition-colors duration-150 hover:bg-accent hover:text-canvas"
                >
                  Download the scrubbed picture
                </a>

                <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-muted">
                  The file is drawn in your browser and carries none of the
                  metadata the original had.
                </p>
              </div>
            ) : null}
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
