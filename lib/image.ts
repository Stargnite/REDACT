import { parseLooseJson } from "./parse";
import { describeType } from "./taxonomy";
import type { BoundingBox, Severity } from "./types";

/**
 * Finding sensitive things in a picture.
 *
 * The model returns rectangles, in the normalised 0-1000 coordinates the
 * Gemini models use, and the coordinates are checked here before anything is
 * drawn. A box that lands outside the image, or that has no area, is dropped
 * rather than painted: a black bar across the wrong part of a screenshot is
 * worse than a missed secret, because the user cannot tell the difference
 * between a redacted region and a broken one.
 */

export interface ImageRegion {
  /** The machine code, e.g. "EMAIL". */
  type: string;
  /** The human label, e.g. "EMAIL". */
  label: string;
  severity: Severity;
  /** Normalised 0-1000, relative to the whole image. */
  box: BoundingBox;
}

const TYPE_KEYS = ["type", "label", "category", "kind", "class"];
const BOX_KEYS = [
  "box",
  "bbox",
  "boundingBox",
  "bounding_box",
  "rect",
  "rectangle",
  "region",
  "area",
];
const LIST_KEYS = [
  "regions",
  "findings",
  "detections",
  "items",
  "boxes",
  "results",
  "sensitive",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberAt(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

/**
 * Reads a rectangle out of whatever shape the model used: an object with x,
 * y, width and height; an object with two corners; or a four-number array.
 */
function boxFromUnknown(value: unknown): BoundingBox | null {
  if (Array.isArray(value)) {
    const [x, y, width, height] = value.map((entry) => Number(entry));
    if ([x, y, width, height].some((entry) => !Number.isFinite(entry))) return null;
    return { x, y, width, height };
  }

  if (!isRecord(value)) return null;

  const x = numberAt(value, ["x", "left", "x1", "xMin", "x_min"]);
  const y = numberAt(value, ["y", "top", "y1", "yMin", "y_min"]);
  const width = numberAt(value, ["width", "w"]);
  const height = numberAt(value, ["height", "h"]);

  if (x !== null && y !== null && width !== null && height !== null) {
    return { x, y, width, height };
  }

  const x2 = numberAt(value, ["x2", "right", "xMax", "x_max"]);
  const y2 = numberAt(value, ["y2", "bottom", "yMax", "y_max"]);

  if (x !== null && y !== null && x2 !== null && y2 !== null) {
    return { x, y, width: x2 - x, height: y2 - y };
  }

  return null;
}

/**
 * Brings a rectangle into the 0-1000 space.
 *
 * Models are inconsistent: some answer in thousandths, some in fractions of
 * the image. The tell is the size of the numbers, so a box whose every value
 * is at most one is read as a fraction and scaled up.
 */
export function toThousandths(box: BoundingBox): BoundingBox {
  const scale = Math.max(box.x, box.y, box.width, box.height) <= 1 ? 1000 : 1;

  return {
    x: box.x * scale,
    y: box.y * scale,
    width: box.width * scale,
    height: box.height * scale,
  };
}

/** Clamps a rectangle to the image and throws away the ones with no area. */
export function clampBox(box: BoundingBox): BoundingBox | null {
  const x = Math.max(0, Math.min(1000, box.x));
  const y = Math.max(0, Math.min(1000, box.y));
  const width = Math.max(0, Math.min(1000 - x, box.width));
  const height = Math.max(0, Math.min(1000 - y, box.height));

  if (width <= 0 || height <= 0) return null;

  return { x, y, width, height };
}

/**
 * Turns the model's answer into regions we are willing to draw.
 *
 * Anything that does not survive the checks is dropped silently: a model that
 * reports a box we cannot place is a model that has made a mistake, and the
 * user should not have to read about it.
 */
export function parseRegions(raw: string): ImageRegion[] {
  const parsed = parseLooseJson(raw);
  if (!parsed.ok) return [];

  let container: unknown = parsed.value;

  if (isRecord(container)) {
    for (const key of LIST_KEYS) {
      if (container[key] !== undefined) {
        container = container[key];
        break;
      }
    }
  }

  if (!Array.isArray(container)) return [];

  const regions: ImageRegion[] = [];

  for (const item of container) {
    if (!isRecord(item)) continue;

    const type =
      TYPE_KEYS.map((key) => item[key]).find(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      ) ?? "DETECTED";

    let rawBox: BoundingBox | null = null;

    for (const key of BOX_KEYS) {
      rawBox = boxFromUnknown(item[key]);
      if (rawBox) break;
    }

    if (!rawBox) rawBox = boxFromUnknown(item);

    if (!rawBox) continue;

    const box = clampBox(toThousandths(rawBox));
    if (!box) continue;

    const code = type.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const description = describeType(code);

    regions.push({
      type: code,
      label: description.label,
      severity: description.severity,
      box,
    });
  }

  return regions;
}

/** The rectangle in the pixels of an image of this size. */
export function regionInPixels(
  box: BoundingBox,
  width: number,
  height: number
): BoundingBox {
  return {
    x: (box.x / 1000) * width,
    y: (box.y / 1000) * height,
    width: (box.width / 1000) * width,
    height: (box.height / 1000) * height,
  };
}

/** The centre of a rectangle, as a fraction of the image. */
export function regionCentre(box: BoundingBox): { x: number; y: number } {
  return {
    x: (box.x + box.width / 2) / 1000,
    y: (box.y + box.height / 2) / 1000,
  };
}
