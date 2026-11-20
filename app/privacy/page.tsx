import type { Metadata } from "next";
import { Reveal } from "@/components/motion/reveal";
import { Hairline, SectionLabel } from "@/components/site/section-label";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What REDACT sends, what it keeps, and the number that tells you which of the two happened on your last scan.",
};

const FACTS = [
  {
    index: "01",
    title: "There is no server",
    body: "REDACT is a static site. The HTML, the styles, and the scripts are files. There is no application server and no database of your text, because there is nowhere for one to live.",
  },
  {
    index: "02",
    title: "Your text is never uploaded on the way in",
    body: "Pasting text into the editor does nothing. No fetch, no beacon, no analytics. The pattern tier reads it in the page and the on-device model reads it inside Chrome.",
  },
  {
    index: "03",
    title: "The model tier may leave the machine",
    body: "When the text is larger than the on-device model can hold, or when you choose Cloud, it is sent to Gemini in the cloud to be scanned. That is the one moment your text leaves the browser, and it is never silent.",
  },
  {
    index: "04",
    title: "The counter is the receipt",
    body: "Every scan ends with a line telling you how many characters went in and how many went out. On device it reads zero sent. In the cloud it reads the exact number. Nothing is left for you to infer.",
  },
  {
    index: "05",
    title: "The leak test only sends the copy",
    body: "The probe that checks a clean copy for leaks is given the copy and the kinds of thing that were removed. It never gets the original, so even when the probe runs in the cloud, the only text that leaves the machine is text you were about to send anyway.",
  },
];

export default function PrivacyPage() {
  return (
    <>
      <section className="mx-auto max-w-[var(--content-w)] px-[var(--gutter)] pt-[clamp(4rem,9vw,7rem)]">
        <h1 className="text-display text-text">Privacy</h1>

        <p className="measure mt-6 text-muted">
          A privacy page that only says we take your privacy seriously is worth
          nothing. This one is a list of facts, and every one of them is either
          checkable in the network tab or printed on the screen after a scan.
        </p>
      </section>

      <section className="mx-auto mt-[clamp(6rem,12vw,9rem)] max-w-[var(--content-w)] px-[var(--gutter)]">
        <SectionLabel index="01">The facts</SectionLabel>
        <Hairline className="mt-6" />

        <ul>
          {FACTS.map((fact) => (
            <Reveal as="li" key={fact.index}>
              <div className="grid gap-3 border-b border-hairline py-7 sm:grid-cols-[4rem_1fr_1.6fr] sm:gap-8">
                <span className="mono text-accent">{fact.index}</span>
                <span className="font-display text-h3 text-text">{fact.title}</span>
                <p className="text-muted">{fact.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-[clamp(7rem,14vw,12rem)] max-w-[var(--content-w)] px-[var(--gutter)]">
        <SectionLabel index="02">What is stored</SectionLabel>
        <Hairline className="mt-6" />

        <Reveal>
          <div className="measure-tight pt-7">
            <p className="text-muted">
              Nothing about your text is stored, anywhere, by the app itself. A
              scan leaves no record. The receipt you see is generated in the
              page and discarded when you close the tab.
            </p>
            <p className="mt-6 text-muted">
              If you turn on the optional counter, what reaches storage is
              metadata about the run and never the run itself: the timestamp,
              the character count, the number of findings by severity, which
              tier handled it, and how long it took. No quoted span, no masked
              text, no input.
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
