import type { ScanResult } from "@/lib/types";

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * The honest part of the product. The number that matters is the one on the
 * right: characters sent off the machine. When the scan ran on device it
 * reads zero, and the zero is the only vermilion on the line.
 */
export function PrivacyMeter({ result }: { result: ScanResult }) {
  const onDevice = result.inferenceSource === "ON_DEVICE";

  return (
    <p className="mono flex flex-wrap items-center gap-x-3 gap-y-1 text-faint">
      <span>{formatCount(result.charCount)} CHARS IN</span>
      <span aria-hidden className="text-hairline">
        ·
      </span>
      <span>
        <span className={onDevice ? "text-accent" : "text-text"}>
          {formatCount(result.charsSent)}
        </span>{" "}
        CHARS SENT
      </span>
    </p>
  );
}
