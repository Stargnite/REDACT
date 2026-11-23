import type { Metadata } from "next";
import { ScanPanel } from "@/components/scan/scan-panel";

export const metadata: Metadata = {
  title: "Scan",
  description:
    "Paste the text you are about to send to an assistant and get back a clean copy with every sensitive span replaced.",
};

export default function ScanPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-[56rem] flex-col px-[var(--gutter)] pt-[clamp(2rem,5vw,3.5rem)] pb-4">
      <h1 className="text-h1 text-text">Scan</h1>

      <p className="measure mt-5 text-muted">
        Paste the text you are about to send to an assistant. Say where it is
        going, and REDACT finds the spans that are sensitive for that
        destination, then hands back a copy with each one replaced by a token
        that names the type or by a generic phrase that keeps the sentence
        readable.
      </p>

      <div className="mt-8 flex flex-1 flex-col">
        <ScanPanel />
      </div>
    </section>
  );
}
