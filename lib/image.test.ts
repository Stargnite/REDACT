import { describe, expect, it } from "vitest";
import {
  clampBox,
  parseRegions,
  regionCentre,
  regionInPixels,
  toThousandths,
} from "./image";

describe("the coordinates", () => {
  it("reads a box in thousandths as it is", () => {
    expect(toThousandths({ x: 120, y: 300, width: 400, height: 40 })).toEqual({
      x: 120,
      y: 300,
      width: 400,
      height: 40,
    });
  });

  it("reads a box in fractions and scales it up", () => {
    expect(toThousandths({ x: 0.12, y: 0.3, width: 0.4, height: 0.04 })).toEqual({
      x: 120,
      y: 300,
      width: 400,
      height: 40,
    });
  });

  it("clamps a box that runs off the edge of the image", () => {
    expect(clampBox({ x: -50, y: -20, width: 2000, height: 2000 })).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
    });
  });

  it("drops a box with no area", () => {
    expect(clampBox({ x: 100, y: 100, width: 0, height: 40 })).toBeNull();
    expect(clampBox({ x: 100, y: 100, width: 40, height: 0 })).toBeNull();
  });

  it("puts a box into the pixels of the picture", () => {
    expect(regionInPixels({ x: 500, y: 250, width: 500, height: 100 }, 1000, 500)).toEqual({
      x: 500,
      y: 125,
      width: 500,
      height: 50,
    });
  });

  it("finds the middle of a box", () => {
    expect(regionCentre({ x: 0, y: 0, width: 200, height: 400 })).toEqual({
      x: 0.1,
      y: 0.2,
    });
  });
});

describe("reading the model's answer", () => {
  it("reads the shape it was asked for", () => {
    const regions = parseRegions(
      JSON.stringify({
        regions: [
          { type: "EMAIL", box: { x: 120, y: 300, width: 400, height: 40 } },
        ],
      })
    );

    expect(regions).toHaveLength(1);
    expect(regions[0].type).toBe("EMAIL");
    expect(regions[0].label).toBe("EMAIL");
    expect(regions[0].severity).toBe("high");
    expect(regions[0].box).toEqual({ x: 120, y: 300, width: 400, height: 40 });
  });

  it("reads a box given as two corners", () => {
    const regions = parseRegions(
      JSON.stringify({
        regions: [{ type: "PERSON", box: { x1: 10, y1: 20, x2: 110, y2: 60 } }],
      })
    );

    expect(regions[0].box).toEqual({ x: 10, y: 20, width: 100, height: 40 });
  });

  it("reads a box given as four numbers", () => {
    const regions = parseRegions(
      JSON.stringify({ findings: [{ label: "PHONE", box: [10, 20, 100, 40] }] })
    );

    expect(regions[0].type).toBe("PHONE");
    expect(regions[0].box).toEqual({ x: 10, y: 20, width: 100, height: 40 });
  });

  it("reads a list under a different name", () => {
    const regions = parseRegions(
      JSON.stringify({ detections: [{ kind: "IP_ADDRESS", bbox: { x: 1, y: 2, width: 3, height: 4 } }] })
    );

    expect(regions).toHaveLength(1);
    expect(regions[0].type).toBe("IP_ADDRESS");
  });

  it("drops a box it cannot place", () => {
    const regions = parseRegions(
      JSON.stringify({
        regions: [
          { type: "EMAIL", box: { x: 100, y: 100, width: 0, height: 0 } },
          { type: "EMAIL", box: { x: 100, y: 100, width: 40, height: 20 } },
        ],
      })
    );

    expect(regions).toHaveLength(1);
  });

  it("drops a region with no box at all", () => {
    const regions = parseRegions(JSON.stringify({ regions: [{ type: "EMAIL" }] }));
    expect(regions).toHaveLength(0);
  });

  it("returns nothing when the model answered with prose", () => {
    expect(parseRegions("I cannot see anything sensitive in this picture.")).toEqual([]);
  });

  it("returns nothing when the model said there was nothing to find", () => {
    expect(parseRegions(JSON.stringify({ regions: [] }))).toEqual([]);
  });

  it("survives a response wrapped in a code fence", () => {
    const regions = parseRegions(
      "```json\n" +
        JSON.stringify({ regions: [{ type: "EMAIL", box: { x: 10, y: 20, width: 30, height: 40 } }] }) +
        "\n```"
    );

    expect(regions).toHaveLength(1);
  });
});
