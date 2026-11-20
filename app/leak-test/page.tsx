import type { Metadata } from "next";
import { LeakTestPanel } from "@/components/leak-test/leak-test-panel";

export const metadata: Metadata = {
  title: "Leak test",
  description:
    "Check a redacted copy against the text it came from and see what a reader could still work out.",
};

export default function LeakTestPage() {
  return (
    <section className="mx-auto max-w-[var(--content-w)] px-[var(--gutter)] pt-[clamp(4rem,9vw,7rem)]">
      <h1 className="text-display text-text">Leak test</h1>

      <p className="measure mt-6 text-muted">
        A redaction that leaves a trace is not a redaction. Paste the text, and
        REDACT scrubs it, then attacks its own work: it checks whether anything
        came back through the rewrite, and asks the model what a reader could
        still work out from the copy alone. The probe never sees the original,
        so the report can never be the thing that leaks.
      </p>

      <div className="mt-10 sm:mt-14">
        <LeakTestPanel />
      </div>
    </section>
  );
}
