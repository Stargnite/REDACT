import { drawRegions, loadImage } from "./image-canvas";
import {
  boxForSpan,
  readImageText,
  type OcrProgressReporter,
  type OcrTranscript,
} from "./ocr";
import type { ProgressReporter } from "./progress";
import { scrub } from "./scrub";
import type { ModelRunner } from "./model";
import type { BoundingBox, ScanContext, ScanMode, Severity } from "./types";

/**
 * Scrubbing a picture.
 *
 * The flow is: read the words out of the picture, on this machine; scan that
 * text with the tiers the text scanner already uses; and draw the spans that
 * came back on the picture, exactly where the words were.
 *
 * The picture is never sent to a model. A model is good at reading text and
 * bad at saying where the text is, and a picture is worth redacting only if
 * the bars land on the right words. So the reader finds the words and where
 * they are, and the model is asked the same question it is asked about any
 * other text: which of these should not leave the machine.
 */

export interface PictureRegion {
  /** The machine code, e.g. "EMAIL". */
  type: string;
  /** The human label. */
  label: string;
  severity: Severity;
  /** The box in the pixels of the picture. */
  box: BoundingBox;
  /** The text that was found, so the user can see what was covered. */
  quote: string;
}

export interface PictureScrubOptions {
  mode: ScanMode;
  context: ScanContext;
  /** Omit it and the scan runs the pattern tier only. */
  runner?: ModelRunner;
  /** Reads the words out of a picture. Injected so it can be tested. */
  read?: (blob: Blob, onProgress?: OcrProgressReporter) => Promise<OcrTranscript>;
  /** Reports each stage as it starts and finishes. */
  onProgress?: ProgressReporter;
}

export interface PictureScrubResult {
  /** The spans that were covered. */
  regions: PictureRegion[];
  /** The scrubbed picture. Null when there was nothing to cover. */
  output: Blob | null;
  /** The text that was read out of the picture. */
  transcript: string;
  /** Where the scan of that text ran. */
  source: "on_device" | "in_cloud" | "none";
  /** True when the run had to move from the device to the cloud. */
  escalated: boolean;
  /** Characters of text that left the machine. Zero for every on-device run. */
  charsSent: number;
  /** The size of the picture, in bytes. */
  imageBytes: number;
  width: number;
  height: number;
  durationMs: number;
  context: ScanContext;
  /** Set when the model tier could not run, so only the rules ran. */
  degradedReason?: string;
  /** Spans the model reported that could not be placed, so they are uncovered. */
  unmatchedCount?: number;
  /** Set when the picture could not be read at all. */
  error?: string;
}

/**
 * How much two boxes have to overlap before they are the same region.
 *
 * The pattern tier can match the same phone twice, once with the country
 * code and once without. In text that is two findings about one span. On a
 * picture they land on the same pixels, so one of them is dropped rather
 * than drawn twice and counted twice.
 */
const OVERLAP_THRESHOLD = 0.5;

function overlapRatio(a: BoundingBox, b: BoundingBox): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  if (right <= left || bottom <= top) return 0;

  const shared = (right - left) * (bottom - top);
  const smaller = Math.min(a.width * a.height, b.width * b.height);

  return smaller > 0 ? shared / smaller : 0;
}

export async function scrubPicture(
  file: Blob,
  options: PictureScrubOptions
): Promise<PictureScrubResult> {
  const started = Date.now();
  const loaded = await loadImage(file);
  const read = options.read ?? readImageText;

  let transcript: OcrTranscript;

  options.onProgress?.({
    id: "read",
    label: "READING THE PICTURE",
    status: "running",
    fraction: null,
  });

  try {
    transcript = await read(file, (progress) => {
      options.onProgress?.({
        id: "read",
        label: progress.label,
        status: "running",
        fraction: progress.fraction,
      });
    });
  } catch (error) {
    options.onProgress?.({
      id: "read",
      label: "READING THE PICTURE",
      status: "done",
      fraction: 1,
    });
    return {
      regions: [],
      output: null,
      transcript: "",
      source: "none",
      escalated: false,
      charsSent: 0,
      imageBytes: file.size,
      width: loaded.width,
      height: loaded.height,
      durationMs: Date.now() - started,
      context: options.context,
      error:
        error instanceof Error && error.message
          ? error.message
          : "The picture could not be read.",
    };
  }

  options.onProgress?.({
    id: "read",
    label: "READING THE PICTURE",
    status: "done",
    fraction: 1,
  });

  const scan = await scrub(transcript.text, {
    mode: options.mode,
    runner: options.runner,
    context: options.context,
    onProgress: options.onProgress,
  });

  const regions: PictureRegion[] = [];

  for (const finding of scan.findings) {
    if (finding.decision !== "redact") continue;

    const box = boxForSpan(transcript, finding.start, finding.end);
    if (!box) continue;

    const duplicate = regions.some(
      (region) => overlapRatio(region.box, box) > OVERLAP_THRESHOLD
    );
    if (duplicate) continue;

    regions.push({
      type: finding.type,
      label: finding.label,
      severity: finding.severity,
      quote: finding.quote,
      box,
    });
  }

  options.onProgress?.({
    id: "cover",
    label: "COVERING THE WORDS",
    status: "running",
    fraction: null,
  });

  const output = await drawRegions(
    loaded,
    regions.map((region) => region.box)
  );

  options.onProgress?.({
    id: "cover",
    label: "COVERING THE WORDS",
    status: "done",
    fraction: 1,
  });

  return {
    regions,
    output,
    transcript: transcript.text,
    source:
      scan.inferenceSource === "IN_CLOUD"
        ? "in_cloud"
        : scan.inferenceSource === "ON_DEVICE"
          ? "on_device"
          : "none",
    escalated: scan.escalated,
    charsSent: scan.charsSent,
    imageBytes: file.size,
    width: loaded.width,
    height: loaded.height,
    durationMs: Date.now() - started,
    context: options.context,
    degradedReason: scan.degradedReason,
    unmatchedCount: scan.unmatchedCount,
  };
}
