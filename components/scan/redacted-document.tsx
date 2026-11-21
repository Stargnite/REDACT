import type { Finding } from "@/lib/types";

/**
 * The scrubbed document.
 *
 * This is the picture of the result rather than the result: the text the user
 * pasted, with a black bar laid over every span that was covered. It is what
 * makes the scrub legible at a glance, and it is deliberately not the clean
 * copy, because the clean copy is what you send and this is what you check.
 *
 * The bar is a real bar. The text under it is transparent, so it cannot be
 * selected or copied out of the page by accident.
 */
export function RedactedDocument({
  text,
  findings,
}: {
  text: string;
  findings: Finding[];
}) {
  const bars = findings
    .filter((finding) => finding.decision === "redact")
    .sort((a, b) => a.start - b.start);

  const parts: (string | Finding)[] = [];
  let cursor = 0;

  for (const finding of bars) {
    if (finding.start < cursor) continue;
    if (finding.start > cursor) parts.push(text.slice(cursor, finding.start));
    parts.push(finding);
    cursor = finding.end;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));

  return (
    <div>
      <div className="max-h-[26rem] overflow-auto whitespace-pre-wrap break-words border border-hairline bg-surface p-4 text-sm leading-relaxed text-text [overflow-wrap:anywhere]">
        {parts.map((part, index) =>
          typeof part === "string" ? (
            <span key={index}>{part}</span>
          ) : (
            <span
              key={index}
              title={part.label}
              aria-label={`${part.label}, covered`}
              className="select-none rounded-[1px] bg-black px-[0.12em] text-transparent"
            >
              {part.quote}
            </span>
          )
        )}
      </div>

      <p className="mono mt-3 text-faint">
        {bars.length} SPAN{bars.length === 1 ? "" : "S"} COVERED · A BLACK BAR
        IS A SPAN THAT WAS REMOVED
      </p>
    </div>
  );
}
