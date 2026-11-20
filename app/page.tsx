import Link from "next/link";
import { MaskReveal, Reveal } from "@/components/motion/reveal";
import { Hairline, SectionLabel } from "@/components/site/section-label";

const STEPS = [
  {
    index: "01",
    title: "Paste it in",
    body: "The text never leaves the tab. Nothing is uploaded, stored, or logged on the way in.",
  },
  {
    index: "02",
    title: "We read it locally",
    body: "Gemini Nano runs inside Chrome and looks for names, keys, addresses, and account numbers.",
  },
  {
    index: "03",
    title: "You get the clean copy",
    body: "Every span is replaced with a token that says what was removed and nothing about what it was.",
  },
];

const CATCHES = [
  "AWS, GCP, GitHub, Slack and Stripe keys",
  "Private keys and JSON web tokens",
  "Names, emails, phone numbers, addresses",
  "Card numbers, IBANs, employer and location",
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-[var(--content-w)] px-[var(--gutter)] pt-[clamp(5rem,12vw,10rem)]">
        <MaskReveal words={["Paste", "safe."]} className="block text-display text-text" />

        <Reveal delay={0.2}>
          <p className="measure mt-8 text-muted">
            REDACT finds the sensitive parts of a block of text before you paste it into
            an assistant. The detection runs on your own machine. The counter on the
            results panel tells you exactly how much, if anything, was sent.
          </p>
        </Reveal>

        <Reveal delay={0.3}>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/scan"
              className="inline-flex items-center justify-center bg-accent px-7 py-3.5 text-sm text-canvas transition-colors duration-150 hover:bg-[#ff6237]"
            >
              Open the scrubber
            </Link>
            <Link
              href="/how-it-works"
              className="mono border border-hairline px-7 py-3.5 text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
            >
              How it works
            </Link>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto mt-[clamp(7rem,14vw,12rem)] max-w-[var(--content-w)] px-[var(--gutter)]">
        <SectionLabel index="01">How it works</SectionLabel>
        <Hairline className="mt-6" />

        <ul>
          {STEPS.map((step) => (
            <Reveal as="li" key={step.index}>
              <div className="grid gap-3 border-b border-hairline py-7 sm:grid-cols-[4rem_1fr_1.4fr] sm:gap-8">
                <span className="mono text-accent">{step.index}</span>
                <span className="font-display text-h3 text-text">{step.title}</span>
                <p className="text-muted">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-[clamp(7rem,14vw,12rem)] max-w-[var(--content-w)] px-[var(--gutter)]">
        <SectionLabel index="02">What it catches</SectionLabel>
        <Hairline className="mt-6" />

        <div className="grid gap-x-10 gap-y-3 pt-7 sm:grid-cols-2">
          {CATCHES.map((item) => (
            <p key={item} className="flex items-baseline gap-3 text-muted">
              <span aria-hidden className="text-accent">
                —
              </span>
              {item}
            </p>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-[clamp(7rem,14vw,12rem)] max-w-[var(--content-w)] px-[var(--gutter)]">
        <SectionLabel index="03">The claim, and the proof</SectionLabel>
        <Hairline className="mt-6" />

        <Reveal>
          <div className="measure-tight pt-7">
            <p className="text-muted">
              REDACT is a static site. There is no backend, no database of your text, and
              no account. When the on-device model handles the scan, the character
              counter reads zero sent. When it does not fit, the counter tells you how
              many characters went to the cloud instead of leaving you to guess.
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
