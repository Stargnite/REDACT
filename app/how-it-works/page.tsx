import type { Metadata } from "next";
import { Reveal } from "@/components/motion/reveal";
import { Hairline, SectionLabel } from "@/components/site/section-label";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Two tiers run behind one scan. A set of deterministic rules catches what has a fixed shape, and a language model catches what does not.",
};

const TIERS = [
  {
    index: "01",
    title: "The pattern tier",
    body: "Twenty-one rules run against the text in your browser, and a set of field labels runs with them. A form that writes FULL NAME over a name has told us what the name is, so it is covered whether or not the model happened to notice it that day. A credential has a fixed shape, so a rule is more reliable than a model for it, and it costs nothing to run. The pattern tier always runs, even with no network.",
  },
  {
    index: "02",
    title: "The model tier",
    body: "Gemini Nano runs inside Chrome and reads for the things that have no fixed shape: a person's name, an employer, a location, a home address. It returns the exact characters it found, never an offset.",
  },
  {
    index: "03",
    title: "The offset step",
    body: "A model-supplied character offset is a guess. A quote is something we can check, so we search the source text for the exact quote we were given and drop the finding if it is not there. A model that paraphrases, or invents a secret, cannot corrupt the masking.",
  },
  {
    index: "04",
    title: "The masking step",
    body: "Each surviving span is replaced by a token that reads [REDACTED:AWS_ACCESS_KEY]. The token names the kind of secret and reveals none of its content, so the assistant still knows what it is looking at.",
  },
];

const SEVERITIES = [
  {
    name: "Critical",
    detail: "Credentials that grant access. Drawn with a solid underline.",
  },
  {
    name: "High",
    detail: "Personal data that identifies a person. Drawn with a dashed underline.",
  },
  {
    name: "Low",
    detail: "Identifiers that narrow a person down. Drawn with a dotted underline.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="mx-auto max-w-[var(--content-w)] px-[var(--gutter)] pt-[clamp(4rem,9vw,7rem)]">
        <h1 className="text-display text-text">How it works</h1>

        <p className="measure mt-6 text-muted">
          A scan is two tiers and three steps. The tiers decide what reads your
          text. The steps decide what happens to what they find.
        </p>
      </section>

      <section className="mx-auto mt-[clamp(6rem,12vw,9rem)] max-w-[var(--content-w)] px-[var(--gutter)]">
        <SectionLabel index="01">The tiers</SectionLabel>
        <Hairline className="mt-6" />

        <ul>
          {TIERS.map((tier) => (
            <Reveal as="li" key={tier.index}>
              <div className="grid gap-3 border-b border-hairline py-7 sm:grid-cols-[4rem_1fr_1.6fr] sm:gap-8">
                <span className="mono text-accent">{tier.index}</span>
                <span className="font-display text-h3 text-text">{tier.title}</span>
                <p className="text-muted">{tier.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-[clamp(7rem,14vw,12rem)] max-w-[var(--content-w)] px-[var(--gutter)]">
        <SectionLabel index="02">Severity</SectionLabel>
        <Hairline className="mt-6" />

        <dl className="pt-7">
          {SEVERITIES.map((severity) => (
            <div
              key={severity.name}
              className="grid gap-2 border-b border-hairline py-6 sm:grid-cols-[10rem_1fr] sm:gap-8"
            >
              <dt className="mono text-faint">{severity.name.toUpperCase()}</dt>
              <dd className="text-muted">{severity.detail}</dd>
            </div>
          ))}
        </dl>

        <p className="measure-tight mt-8 text-muted">
          Colour never carries the severity. The underline style does, so the
          page reads the same in greyscale, in bright sunlight, and for
          someone who cannot tell vermilion from anything else.
        </p>      </section>

      <section className="mx-auto mt-[clamp(7rem,14vw,12rem)] max-w-[var(--content-w)] px-[var(--gutter)]">
        <SectionLabel index="03">Pictures</SectionLabel>
        <Hairline className="mt-6" />

        <Reveal>
          <div className="measure-tight pt-7">
            <p className="text-muted">
              A screenshot carries more identifying detail than the text you
              copy out of it, and none of it is text you can paste. So the
              picture scrubber works in two halves: an optical character reader
              runs in your browser and finds the words and the pixels each word
              covers, and then the same two tiers scan that text.
            </p>
            <p className="mt-6 text-muted">
              The words are found by reading, not by asking a model where they
              are. A model can tell you what a screenshot says, but it cannot
              reliably tell you which pixels the address is in, and a black bar
              across the wrong part of a screenshot is worse than a missed
              secret: you cannot tell a redaction from a mistake. Every span
              that comes back is matched to the words it covers, so the bar
              lands on the text it is meant to hide. The picture itself is
              never sent anywhere, and the copy that comes back is drawn in
              the browser, so it carries none of the metadata the original
              had.
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
