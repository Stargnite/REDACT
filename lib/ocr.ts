import type { BoundingBox } from "./types";

/**
 * Reading the words out of a picture.
 *
 * The picture is read here, on the machine, by an optical character reader
 * that runs in a worker. Nothing about the picture leaves the browser: what
 * leaves is the text that was read out of it, and only if the user asked for
 * the cloud tier.
 *
 * The reader gives us a word, the pixels it covers, and how sure it is. From
 * those we build a transcript, the same shape of text a person would have
 * copied out of the screenshot, with every character tied to the box it came
 * from. A finding in the transcript can then be drawn on the picture exactly
 * where those characters were.
 */

/** One word the reader found, and where it was. */
export interface OcrWord {
  text: string;
  /** The box in the pixels of the picture. */
  box: BoundingBox;
  /** How sure the reader was, from 0 to 100. */
  confidence: number;
}

/** A word, with the characters it occupies in the transcript. */
export interface OcrWordSpan {
  text: string;
  /** Where the word starts in the transcript. */
  start: number;
  /** Where the word ends in the transcript. */
  end: number;
  box: BoundingBox;
}

/** A line of the transcript, and the words it is made of. */
export interface OcrLine {
  text: string;
  start: number;
  end: number;
  words: OcrWordSpan[];
  box: BoundingBox;
}

/** Everything the reader found, as text with a way back to the pixels. */
export interface OcrTranscript {
  text: string;
  lines: OcrLine[];
}

/**
 * When two words are closer than this, times the height of the line, they
 * are one word that the reader split, and no space goes between them.
 *
 * A space between two words of a 25 pixel line is about 12 pixels. The gap
 * inside a word is about 4. The line height is the only ruler we have that
 * survives a change of font size.
 */
const JOIN_GAP_RATIO = 0.3;

/** Words closer than this, times the line height, are on the same line. */
const SAME_LINE_RATIO = 0.6;

function unionBox(boxes: BoundingBox[]): BoundingBox {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));

  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Groups the words into lines.
 *
 * The reader hands back words in reading order, but not always in a tidy
 * one. Words are sorted by how high they sit, put on a line when they sit
 * at the same height, and then sorted left to right.
 */
export function groupWordsIntoLines(words: OcrWord[]): OcrLine[] {
  const usable = words.filter((word) => word.text.trim().length > 0);
  if (!usable.length) return [];

  const byHeight = [...usable].sort((a, b) => a.box.y - b.box.y);
  const clusters: OcrWord[][] = [];

  for (const word of byHeight) {
    const current = clusters[clusters.length - 1];

    if (current) {
      const lineHeight = Math.max(
        ...current.map((w) => w.box.height),
        word.box.height
      );
      const lineCentre =
        current.reduce((sum, w) => sum + w.box.y + w.box.height / 2, 0) /
        current.length;
      const wordCentre = word.box.y + word.box.height / 2;

      if (Math.abs(wordCentre - lineCentre) <= lineHeight * SAME_LINE_RATIO) {
        current.push(word);
        continue;
      }
    }

    clusters.push([word]);
  }

  return clusters.map((cluster) => {
    const sorted = [...cluster].sort((a, b) => a.box.x - b.box.x);
    const height = Math.max(...sorted.map((w) => w.box.height));

    const words: OcrWordSpan[] = [];
    let text = "";

    sorted.forEach((word, index) => {
      if (index > 0) {
        const previous = sorted[index - 1];
        const gap = word.box.x - (previous.box.x + previous.box.width);
        const joiner = gap <= height * JOIN_GAP_RATIO ? "" : " ";
        text += joiner;
      }
      text += word.text;
      words.push({
        text: word.text,
        start: text.length - word.text.length,
        end: text.length,
        box: word.box,
      });
    });

    return {
      text,
      start: 0,
      end: text.length,
      words,
      box: unionBox(sorted.map((w) => w.box)),
    };
  });
}

/**
 * Joins the lines into one transcript and gives every word its place in it.
 *
 * The lines are separated by a newline, the way a person would type them,
 * and the offsets are fixed up so that a character in the transcript can be
 * traced back to the pixels it was read from.
 */
export function buildTranscript(lines: OcrLine[]): OcrTranscript {
  let text = "";
  const placed: OcrLine[] = [];

  for (const line of lines) {
    if (placed.length) text += "\n";
    const start = text.length;
    text += line.text;

    placed.push({
      ...line,
      start,
      end: start + line.text.length,
      words: line.words.map((word) => ({
        ...word,
        start: word.start + start,
        end: word.end + start,
      })),
    });
  }

  return { text, lines: placed };
}

/**
 * The box that covers a span of the transcript.
 *
 * A finding that covers half of an email gets a box around that half of the
 * email, and a finding that covers a whole line gets a box around the line.
 * A span that touches no word has no box, and no box means nothing is
 * drawn.
 */
export function boxForSpan(
  transcript: OcrTranscript,
  start: number,
  end: number
): BoundingBox | null {
  const boxes: BoundingBox[] = [];

  for (const line of transcript.lines) {
    for (const word of line.words) {
      if (word.end <= start || word.start >= end) continue;
      boxes.push(word.box);
    }
  }

  if (!boxes.length) return null;
  return unionBox(boxes);
}

type TesseractWorker = {
  recognize: (
    image: unknown,
    options?: unknown,
    output?: unknown
  ) => Promise<{ data: { blocks?: unknown } }>;
  terminate: () => Promise<unknown>;
};

let workerPromise: Promise<TesseractWorker> | null = null;

/**
 * Reads a picture.
 *
 * The reader is kept between pictures, because starting it costs a few
 * seconds and every picture after the first is then quick.
 */
export async function readImageText(blob: Blob): Promise<OcrTranscript> {
  const worker = await getWorker();

  const { data } = await worker.recognize(blob, {}, { blocks: true });
  const words = collectWords(data.blocks);

  return buildTranscript(groupWordsIntoLines(words));
}

/** Pulls the words and their boxes out of whatever shape the reader used. */
function collectWords(blocks: unknown): OcrWord[] {
  if (!Array.isArray(blocks)) return [];

  const words: OcrWord[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;

    for (const paragraph of (block as { paragraphs?: unknown[] }).paragraphs ?? []) {
      if (!paragraph || typeof paragraph !== "object") continue;

      for (const line of (paragraph as { lines?: unknown[] }).lines ?? []) {
        if (!line || typeof line !== "object") continue;

        for (const word of (line as { words?: unknown[] }).words ?? []) {
          if (!word || typeof word !== "object") continue;

          const record = word as {
            text?: string;
            confidence?: number;
            bbox?: { x0: number; y0: number; x1: number; y1: number };
          };

          if (!record.text?.trim() || !record.bbox) continue;

          words.push({
            text: record.text,
            confidence: record.confidence ?? 0,
            box: {
              x: record.bbox.x0,
              y: record.bbox.y0,
              width: record.bbox.x1 - record.bbox.x0,
              height: record.bbox.y1 - record.bbox.y0,
            },
          });
        }
      }
    }
  }

  return words;
}

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = createReader().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

/**
 * Starts the reader.
 *
 * Everything it needs is served by this site, so the reader works with no
 * network and no third party in the middle.
 */
async function createReader(): Promise<TesseractWorker> {
  const { createWorker } = await import("tesseract.js");

  return (await createWorker("eng", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/tesseract-core-simd-lstm.wasm.js",
    langPath: "/tessdata",
    logger: () => {},
  })) as unknown as TesseractWorker;
}
