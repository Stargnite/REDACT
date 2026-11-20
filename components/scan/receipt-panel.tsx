import { Hairline, SectionLabel } from "@/components/site/section-label";
import { explainModelError } from "@/lib/errors";
import type { ScanResult } from "@/lib/types";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} MS`;
  return `${(ms / 1000).toFixed(1)} S`;
}

/**
 * The receipt records how the scan ran, not what it found. It is metadata
 * about the run, and it never contains a character of the input.
 */
export function ReceiptPanel({ result }: { result: ScanResult }) {
  const rows: [string, string][] = [
    ["TIER", result.inferenceSource.replace(/_/g, " ")],
    ["FINDINGS", String(result.findings.length)],
    ["PATTERN TIER", `${result.patternCount} · ${formatDuration(result.durations.patternsMs)}`],
    ["MODEL TIER", `${result.modelCount} · ${formatDuration(result.durations.modelMs)}`],
    ["TOTAL", formatDuration(result.durations.totalMs)],
  ];

  return (
    <div>
      <SectionLabel index="RECEIPT">This run</SectionLabel>
      <Hairline className="mt-5" />

      <dl className="mono mt-1">
        {rows.map(([term, value]) => (
          <div
            key={term}
            className="flex items-baseline justify-between gap-4 border-b border-hairline py-3"
          >
            <dt className="shrink-0 text-faint">{term}</dt>
            <dd className="min-w-0 break-words text-right text-text">{value}</dd>
          </div>
        ))}
      </dl>

      {result.degradedReason ? (
        <p className="mono mt-4 text-faint">
          MODEL TIER · {explainModelError(result.degradedReason).label}
        </p>
      ) : null}
    </div>
  );
}
