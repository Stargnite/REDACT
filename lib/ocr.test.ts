import { describe, expect, it } from "vitest";
import {
  boxForSpan,
  buildTranscript,
  groupWordsIntoLines,
  type OcrWord,
} from "./ocr";

function word(
  text: string,
  x: number,
  y: number,
  width: number,
  height = 20
): OcrWord {
  return { text, confidence: 95, box: { x, y, width, height } };
}

describe("groupWordsIntoLines", () => {
  it("puts words at the same height on one line, in reading order", () => {
    const lines = groupWordsIntoLines([
      word("world", 200, 100, 50),
      word("hello", 100, 102, 50),
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("hello world");
  });

  it("keeps words on different lines apart", () => {
    const lines = groupWordsIntoLines([
      word("first", 100, 100, 50),
      word("second", 100, 200, 50),
    ]);

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.text)).toEqual(["first", "second"]);
  });

  it("joins a word the reader split when the gap is small", () => {
    const lines = groupWordsIntoLines([
      word("ama", 100, 100, 30),
      word("ra", 134, 100, 20),
    ]);

    expect(lines[0].text).toBe("amara");
  });

  it("keeps a space between words when the gap is wide", () => {
    const lines = groupWordsIntoLines([
      word("northwind", 100, 100, 80),
      word("labs", 220, 100, 40),
    ]);

    expect(lines[0].text).toBe("northwind labs");
  });

  it("drops words that are only whitespace", () => {
    const lines = groupWordsIntoLines([word("   ", 100, 100, 20), word("ok", 140, 100, 20)]);

    expect(lines[0].text).toBe("ok");
  });
});

describe("buildTranscript", () => {
  it("joins the lines with a newline and shifts the word offsets", () => {
    const lines = groupWordsIntoLines([
      word("amara", 100, 100, 50),
      word("okonkwo", 100, 200, 70),
    ]);
    const transcript = buildTranscript(lines);

    expect(transcript.text).toBe("amara\nokonkwo");
    expect(transcript.lines[1].words[0].start).toBe(6);
    expect(transcript.lines[1].words[0].end).toBe(13);
    expect(transcript.text.slice(6, 13)).toBe("okonkwo");
  });
});

describe("boxForSpan", () => {
  const transcript = buildTranscript(
    groupWordsIntoLines([
      word("mail", 100, 100, 40),
      word("amara", 150, 100, 60),
      word("at", 100, 200, 20),
      word("northwind", 130, 200, 80),
    ])
  );

  it("gives the box of the word the span covers", () => {
    const box = boxForSpan(transcript, 5, 10);

    expect(box).not.toBeNull();
    expect(box?.x).toBe(150);
    expect(box?.width).toBe(60);
  });

  it("unions the boxes of every word the span touches", () => {
    const box = boxForSpan(transcript, 0, 10);

    expect(box?.x).toBe(100);
    expect(box?.width).toBe(110);
    expect(box?.height).toBe(20);
  });

  it("has no box for a span that touches no word", () => {
    // The newline between the two lines belongs to no word.
    expect(boxForSpan(transcript, 10, 11)).toBeNull();
  });
});
