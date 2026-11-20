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
        text you copy. It is in the screenshot. REDACT looks at a picture, finds
        the regions that would identify you, and covers them with black bars.
        The picture is drawn in your browser, and it only reaches a server if
        you ask for the cloud model.
      </p>

      <div className="mt-10 sm:mt-14">
        <ImagePanel />
      </div>
    </section>
  );
}
