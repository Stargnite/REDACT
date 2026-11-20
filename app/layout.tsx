import type { Metadata } from "next";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "REDACT — scrub before you paste",
    template: "%s — REDACT",
  },
  description:
    "A local-first scrubber for text you are about to paste into an AI assistant. Sensitive spans are detected on your own machine with Gemini Nano, and only sent to the cloud when they will not fit.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-canvas">
      <body className="bg-canvas text-text antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-accent focus:px-4 focus:py-2 focus:text-canvas"
        >
          Skip to content
        </a>

        <div aria-hidden className="grain" />

        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
