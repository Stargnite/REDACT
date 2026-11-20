import {
  drawRegions,
  loadImage,
  prepareImage,
  toBase64,
} from "./image-canvas";
import { parseRegions, type ImageRegion } from "./image";
import type { ImageRunner } from "./model";
import type { ScanContext, ScanMode } from "./types";

/**
 * Scrubbing a picture.
 *
 * The flow is: decode the file, shrink a copy for the model, ask the model
 * where the sensitive parts are, check the rectangles, and draw them on the
 * original picture. The original pixels are never sent anywhere; only the
 * shrunk copy is, and only in the cloud tier.
 */

export interface ImageScrubOptions {
  mode: ScanMode;
  context: ScanContext;
  runner?: ImageRunner;
}

export interface ImageScrubResult {
  /** The regions that survived the checks. */
  regions: ImageRegion[];
  /** The scrubbed picture. Null when the scan did not get that far. */
  output: Blob | null;
  /** Where the run actually happened. */
  source: "on_device" | "in_cloud" | "none";
  /** True when the run had to move from the device to the cloud. */
  escalated: boolean;
  /** Bytes of picture that left the machine. */
  bytesSent: number;
  /** Bytes of the picture that was sent to the model. */
  bytesTotal: number;
  /** The size of the original picture. */
  width: number;
  height: number;
  durationMs: number;
  /** The context the run was under, echoed back for the receipt. */
  context: ScanContext;
  /** Set when the model tier could not run at all. */
  error?: string;
}

export async function scrubImage(
  file: File,
  options: ImageScrubOptions
): Promise<ImageScrubResult> {
  const started = Date.now();

  const loaded = await loadImage(file);
  const prepared = await prepareImage(loaded);

  const base = {
    regions: [] as ImageRegion[],
    output: null as Blob | null,
    escalated: false,
    bytesSent: 0,
    bytesTotal: prepared.blob.size,
    width: loaded.width,
    height: loaded.height,
    context: options.context,
  };

  if (!options.runner) {
    return {
      ...base,
      source: "none",
      durationMs: Date.now() - started,
      error:
        "No model tier is configured, so nothing could be found in the picture.",
    };
  }

  const input = {
    base64: await toBase64(prepared.blob),
    mimeType: prepared.mimeType,
    width: prepared.width,
    height: prepared.height,
    bytes: prepared.blob.size,
  };

  const wantsDevice = options.mode !== "cloud";

  let run = wantsDevice
    ? await options.runner(input, "on_device", options.context)
    : await options.runner(input, "cloud", options.context);

  let escalated = false;

  // The on-device model may simply not be able to see. When the mode is auto,
  // that is a reason to go to the cloud, and the receipt has to say so.
  if (!run.ok && wantsDevice && options.mode === "auto") {
    run = await options.runner(input, "cloud", options.context);
    escalated = true;
  }

  if (!run.ok) {
    return {
      ...base,
      source: wantsDevice && !escalated ? "on_device" : "in_cloud",
      escalated,
      durationMs: Date.now() - started,
      error: run.error ?? "The model tier could not run.",
    };
  }

  const regions = parseRegions(run.raw);

  return {
    ...base,
    regions,
    output: await drawRegions(loaded, regions),
    source: run.source,
    escalated,
    bytesSent: run.bytesSent,
    durationMs: Date.now() - started,
  };
}
