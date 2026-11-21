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

/**
 * The words on screen.
 *
 * The verdict is about the copy, not about the product, so it says what the
 * copy is like. "LEAKING" in a big block reads as the tool failing; "STILL
 * THERE" reads as the tool catching something. Both mean the same thing, and
 * only one of them is true.
 */
const DISPLAY: Record<Verdict, string> = {
  CLEAN: "NO TRACE",
  TRACEABLE: "A TRACE",
  LEAKING: "STILL THERE",
};

const NOTE: Record<Verdict, string> = {
  CLEAN: "Nothing in the copy gives the removed spans back.",
  TRACEABLE:
    "The copy still narrows things down. Read the traces before you send it.",
  LEAKING: "Part of what was removed is still in the copy. Do not send this.",
};

/**
 * Why there is no verdict at all.
 *
 * A verdict is worth something only if something was removed from the copy.
 * If nothing was, there is no redaction to prove, and a confident "NO TRACE"
 * would be answering a question nobody asked.
 */
export type VerdictCaveat = "none" | "nothing_removed";

const NO_VERDICT: Record<Exclude<VerdictCaveat, "none">, string> = {
  nothing_removed:
    "Nothing was removed from this text, so there is no redaction to prove. What you see is your own text, unchanged.",
};

const NOT_ATTACKED =
  " No model has attacked this copy yet, so this is what the local checks could find on their own.";

const ATTACK_FAILED =
  " The model tried to attack this copy and did not finish, so the verdict is the local checks alone.";

const SCAN_INCOMPLETE =
  " The scan did not finish, so these checks only reached the part of your text the fixed rules could cover.";

export function LeakVerdict({
  verdict,
  score,
  complete,
  probeRan = false,
  caveat = "none",
  partial = false,
}: {
  verdict: Verdict;
  score: number;
  /** False when the probe could not run, so the verdict covers less ground. */
  complete: boolean;
  /** True when the probe was attempted, whatever came of it. */
  probeRan?: boolean;
  caveat?: VerdictCaveat;
  /** True when the scan itself did not finish. */
  partial?: boolean;
}) {
  const noVerdict = caveat !== "none";

  return (
    <div
      className={`p-6 ${noVerdict ? "border border-hairline text-text" : STYLE[verdict]}`}
    >
      <p className="mono text-[0.68rem] tracking-[0.2em] opacity-70">
        {noVerdict ? "NO VERDICT" : "VERDICT"}
      </p>
      <p className="text-display mt-2">
        {noVerdict ? "CANNOT SAY" : DISPLAY[verdict]}
      </p>
      {noVerdict ? null : (
        <p className="mono mt-1 text-[0.68rem] tracking-[0.2em] opacity-70">
          RISK SCORE {score} / 100
        </p>
      )}
      <p className="mt-4 max-w-[46ch] text-sm leading-relaxed opacity-90">
        {noVerdict ? NO_VERDICT[caveat] : NOTE[verdict]}
        {noVerdict ? "" : partial ? SCAN_INCOMPLETE : ""}
        {noVerdict || complete ? "" : probeRan ? ATTACK_FAILED : NOT_ATTACKED}
      </p>
    </div>
  );
}
