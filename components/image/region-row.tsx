"use client";

import type { ImageRegion } from "@/lib/image";
import type { Severity } from "@/lib/types";

/**
 * Type is carried by the label and the underline treatment. Hue never
 * carries type, so the list stays legible in greyscale and to a
 * colour-blind reader.
 */
const DECORATION: Record<Severity, { style: string; thickness: string }> = {
  critical: { style: "solid", thickness: "2px" },
  high: { style: "dashed", thickness: "2px" },
  low: { style: "dotted", thickness: "1px" },
};

export function RegionRow({
  region,
  index,
}: {
  region: ImageRegion;
  index: number;
}) {
  const decoration = DECORATION[region.severity];

  return (
    <li className="border-b border-hairline py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="mono text-faint">{region.label}</span>
        <span className="mono text-faint">REGION {String(index + 1).padStart(2, "0")}</span>
      </div>

      <p className="mt-2 mono text-muted">
        <span
          style={{
            textDecorationLine: decoration.style,
            textDecorationThickness: decoration.thickness,
            textUnderlineOffset: "3px",
            textDecorationColor: "var(--color-accent)",
          }}
        >
          {Math.round(region.box.x)} , {Math.round(region.box.y)} ·{" "}
          {Math.round(region.box.width)} x {Math.round(region.box.height)}
        </span>
      </p>
    </li>
  );
}
