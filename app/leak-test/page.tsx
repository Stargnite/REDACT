import type { Metadata } from "next";
import { LeakTestPanel } from "@/components/leak-test/leak-test-panel";

export const metadata: Metadata = {
  title: "Proof",
  description:
    "Check a redacted copy against the text it came from and see what a reader could still work out.",
};

export default function LeakTestPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-[56rem] flex-col px-[var(--gutter)] pt-[clamp(2rem,5vw,3.5rem)] pb-4">
      <h1 className="text-h1 text-text">Proof</h1>

      <p className="measure mt-5 text-muted">
        A redaction that leaves a trace is not a redaction. Paste the text and
        REDACT scrubs it, then checks its own work: does anything you meant to
        remove come back through the rewrite, or still match a secret it
        should not? If you want a second opinion, ask a model to work the copy
        backwards too. It never sees the original, so the report can never be
        the thing that leaks.
      </p>

      <div className="mt-8 flex flex-1 flex-col">
        <LeakTestPanel />
      </div>
    </section>
  );
}
