import type { Metadata } from "next";
import { ScanPanel } from "@/components/scan/scan-panel";

export const metadata: Metadata = {
  title: "Scan",
  description:
    "Paste the text you are about to send to an assistant and get back a clean copy with every sensitive span replaced.",
};

export default function ScanPage() {
  return (
    <section className="mx-auto max-w-[var(--content-w)] px-[var(--gutter)] pt-[clamp(4rem,9vw,7rem)]">
      <h1 className="text-display text-text">Scan</h1>

      <p className="measure mt-6 text-muted">
        Paste the text you are about to send to an assistant. Say where it is
        going, and REDACT finds the spans that are sensitive for that
        destination, then hands back a copy with each one replaced by a token
        that names the type or by a generic phrase that keeps the sentence
        readable.
      </p>

      <div className="mt-10 sm:mt-14">
        <ScanPanel />
      </div>
    </section>
  );
}
