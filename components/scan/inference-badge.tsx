import type { InferenceSource } from "@/lib/types";

const LABELS: Record<InferenceSource, string> = {
  ON_DEVICE: "ON DEVICE",
  IN_CLOUD: "IN CLOUD",
  PATTERNS_ONLY: "PATTERNS ONLY",
};

/**
 * One accent moment in the panel. When the scan ran on the device, the badge
 * is the only solid vermilion on screen. Everything else stays hairline.
 */
export function InferenceBadge({ source }: { source: InferenceSource }) {
  const onDevice = source === "ON_DEVICE";

  return (
    <span
      className={
        onDevice
          ? "mono inline-flex items-center bg-accent px-2.5 py-1 text-canvas"
          : "mono inline-flex items-center border border-hairline px-2.5 py-1 text-muted"
      }
    >
      {LABELS[source]}
    </span>
  );
}
