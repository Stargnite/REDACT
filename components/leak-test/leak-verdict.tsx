import type { LeakVerdict as Verdict } from "@/lib/leak-test";

/**
 * The verdict is the loudest thing on the page, and it gets louder as the
 * risk goes up: a hairline for clean, an outline for traceable, a solid
 * block for leaking. One accent, used once.
 */
const STYLE: Record<Verdict, string> = {
  CLEAN: "border border-hairline text-text",
  TRACEABLE: "border border-accent text-accent",
  LEAKING: "bg-accent text-canvas",
};

const NOTE: Record<Verdict, string> = {
  CLEAN: "Nothing in the copy gives the removed spans back.",
  TRACEABLE:
    "The copy still narrows things down. Read the claims before you send it.",
  LEAKING: "Part of what was removed is still in the copy. Do not send this.",
};

const PARTIAL =
  " The model probe did not run, so this is what the local checks could find on their own.";

export function LeakVerdict({
  verdict,
  score,
  complete,
}: {
  verdict: Verdict;
  score: number;
  /** False when the probe could not run, so the verdict covers less ground. */
  complete: boolean;
}) {
  return (
    <div className={`p-6 ${STYLE[verdict]}`}>
      <p className="mono text-[0.68rem] tracking-[0.2em] opacity-70">
        VERDICT
      </p>
      <p className="text-display mt-2">{verdict}</p>
      <p className="mono mt-1 text-[0.68rem] tracking-[0.2em] opacity-70">
        RISK SCORE {score} / 100
      </p>
      <p className="mt-4 max-w-[46ch] text-sm leading-relaxed opacity-90">
        {NOTE[verdict]}
        {complete ? "" : PARTIAL}
      </p>
    </div>
  );
}
