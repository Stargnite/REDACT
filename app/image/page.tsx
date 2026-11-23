import type { Metadata } from "next";
import { ImagePanel } from "@/components/image/image-panel";

export const metadata: Metadata = {
  title: "Scrub a picture",
  description:
    "Find the names, addresses, numbers and keys in a screenshot and cover them before you send it on.",
};

export default function ImagePage() {
  return (
    <section className="mx-auto max-w-[var(--content-w)] px-[var(--gutter)] pt-[clamp(4rem,9vw,7rem)]">
      <h1 className="text-display text-text">Scrub a picture</h1>

      <p className="measure mt-6 text-muted">
        Most of the personal information you are about to paste is not in the
        text you copy. It is in the screenshot. REDACT reads the words out of
        the picture on your machine, scans that text with the same tiers the
        text scanner uses, and covers the words that would identify you with
        black bars. The picture never leaves the browser. Only the text read
        out of it can, and only if you ask for the cloud model.
      </p>

      <div className="mt-10 sm:mt-14">
        <ImagePanel />
      </div>
    </section>
  );
}
