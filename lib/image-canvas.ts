import { regionInPixels } from "./image";
import type { BoundingBox } from "./types";
import type { ImageRegion } from "./image";

/**
 * Working with the picture itself.
 *
 * Everything here happens in the browser. The file is never uploaded to be
 * stored anywhere: it is decoded, shrunk, and drawn on, and the only thing
 * that can leave the machine is the model request, and only when the tier
 * says so.
 */

/**
 * The long edge of the image we send to the model.
 *
 * Gemini reads a smaller image as well as a big one, and a phone screenshot
 * at full resolution is mostly wasted tokens. The boxes come back normalised,
 * so shrinking costs nothing but time.
 */
export const MAX_IMAGE_DIMENSION = 1568;

/** Above this the PNG is re-encoded as a JPEG, which is much smaller. */
export const MAX_IMAGE_BYTES = 3_500_000;

export interface LoadedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

export interface PreparedImage {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
}

/** Decodes a file the user picked into something drawable. */
export async function loadImage(file: File): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);

  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
  };
}

/**
 * Shrinks an image to the size we send to the model, and encodes it.
 *
 * PNG first, because a screenshot is text and JPEG smears text. A PNG that
 * comes out too big becomes a JPEG instead, because a request the model
 * refuses is worse than a slightly softer picture.
 */
export async function prepareImage(image: LoadedImage): Promise<PreparedImage> {
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(image.width, image.height)
  );

  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot draw on a canvas.");
  }

  context.drawImage(image.bitmap, 0, 0, width, height);

  const png = await toBlob(canvas, "image/png");

  if (png.size <= MAX_IMAGE_BYTES) {
    return { blob: png, mimeType: "image/png", width, height };
  }

  const jpeg = await toBlob(canvas, "image/jpeg", 0.92);
  return { blob: jpeg, mimeType: "image/jpeg", width, height };
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The image could not be encoded."));
      },
      type,
      quality
    );
  });
}

/** The base64 the SDK's inlineData part wants, without the data URL prefix. */
export function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("The image could not be read."));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };

    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(blob);
  });
}

/**
 * The rectangles in the pixels of the original picture.
 *
 * The padding is in pixels, not in thousandths, because a bar that is a
 * pixel too tight still shows the first letter of a name on some screens.
 */
export function pixelBoxes(
  regions: ImageRegion[],
  width: number,
  height: number
): BoundingBox[] {
  const pad = Math.max(2, Math.round(Math.min(width, height) * 0.006));

  return regions.map((region) => {
    const box = regionInPixels(region.box, width, height);

    return {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: Math.min(width, box.width + pad * 2),
      height: Math.min(height, box.height + pad * 2),
    };
  });
}

/**
 * Draws the black bars and hands back a new picture.
 *
 * The result comes out of a canvas, so it carries no metadata from the
 * original file. A screenshot that never left the device leaves the device
 * without its EXIF either.
 */
export async function drawRegions(
  image: LoadedImage,
  regions: ImageRegion[]
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot draw on a canvas.");
  }

  context.drawImage(image.bitmap, 0, 0);

  context.fillStyle = "#000000";

  for (const box of pixelBoxes(regions, image.width, image.height)) {
    context.fillRect(box.x, box.y, box.width, box.height);
  }

  return toBlob(canvas, "image/png");
}
