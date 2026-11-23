import type { BoundingBox } from "./types";

/**
 * Working with the picture itself.
 *
 * Everything here happens in the browser. The file is decoded and drawn on
 * here, and the copy that comes back carries none of the metadata the
 * original had. The picture itself is never sent anywhere: what can leave
 * the machine is the text read out of it, and only when the tier says so.
 */

export interface LoadedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

/** Decodes a file the user picked into something drawable. */
export async function loadImage(file: Blob): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);

  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
  };
}

/**
 * The box to draw, in the pixels of the picture.
 *
 * A word read out of a screenshot is drawn on tightly, but not so tightly
 * that the tail of a letter with a descender peeks out underneath it.
 */
export function paddedBox(box: BoundingBox): BoundingBox {
  const pad = Math.max(2, Math.round(Math.min(box.width, box.height) * 0.08));

  return {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The picture could not be encoded."));
      },
      type
    );
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
  boxes: BoundingBox[]
): Promise<Blob | null> {
  if (!boxes.length) return null;

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot draw on a canvas.");
  }

  context.drawImage(image.bitmap, 0, 0);
  context.fillStyle = "#000000";

  for (const box of boxes) {
    const padded = paddedBox(box);
    context.fillRect(
      Math.round(padded.x),
      Math.round(padded.y),
      Math.round(padded.width),
      Math.round(padded.height)
    );
  }

  return toBlob(canvas, "image/png");
}
