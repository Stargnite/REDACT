# REDACT

**A paste-box that finds secrets in your text with a local AI model — before you send it to an AI.**

---

## Inspiration

AI assistants turned the clipboard into a leak vector. Every "paste this into ChatGPT to fix it"
workflow now pushes source code, credentials and customer data into a third party's inference
pipeline. The numbers are not theoretical: **29 million secrets were exposed on GitHub in 2025**, AI-assisted commits leaked at roughly **twice** the rate of hand-written ones, and **65% of the Forbes AI 50** had leaked secrets on public repositories.

The existing tools — Presidio, GitGuardian — are server-side, regex-shaped and developer-only.
But the reason they are server-side is the wrong reason, and nobody had fixed it.

Here is the problem we couldn't get past: **you cannot detect a secret by uploading it.** If the
secret is already in the request, the detection *is* the leak. Any tool that sends your text
somewhere to find your secret has, by definition, already lost.

That constraint is what makes on-device inference load-bearing instead of decorative. It wasn't
a checkbox we ticked for the hackathon; it was the only architecture that satisfies both
"find the secret" and "the secret stays here." We noticed the example projects on the Devpost
page were cloud-only, which made the gap obvious.

We also looked at the leak patterns themselves. The failures weren't exotic: an AWS access key
committed in a `.env`, a Slack token in a screenshot, a customer's email address pasted into a
support prompt. Ordinary secrets, ordinary workflows, ordinary carelessness — but now with a
model in the loop that will happily include them in a summary, a snippet, or a memory.

---

## What it does

Paste a block of text. REDACT finds everything sensitive in it and shows you, in place, before
you send it anywhere.

**Three detection tiers, running in order:**

1. **Deterministic (instant, always local).** A rule pass for the things that have a fixed
   shape: AWS access keys, GitHub and OpenAI tokens, JWTs, private key blocks, bearer tokens,
   credential-bearing URLs, email addresses, IBANs, and credit-card numbers (Luhn-checked).
   These are caught with certainty, in microseconds, with no model involved.

2. **On-device AI (local).** Gemini Nano running inside Chrome handles what rules cannot:
   personal names, employers, addresses, dates of birth, licence plates, and the contextual
   phrasing people use ("my wife Jane", "the client at Meridian Ltd"). This is where the
   semantic judgement is needed, and this is where a server would be fatal.

3. **Cloud AI (only when necessary).** When the text genuinely exceeds the on-device model's
   context window — or when you explicitly ask for it — the scan escalates to a Gemini model
   served through the Firebase AI Logic SDK. REDACT tells you it did this, why, and exactly how
   many bytes went out.

**What you get back:** the original text with every finding highlighted and typed. Each one can
be masked, unmasked, or rejected individually. One click copies the redacted version.

**What REDACT never does:** send your text anywhere it wasn't asked to, store your text, or
store the secrets it found. The only thing that reaches the database is a **privacy receipt** —
a metadata-only record (character count, finding counts by type, which model ran, how long it
took) that lets you prove what happened without revealing what was in it.

And the **inference badge** — a live `ON DEVICE` / `IN CLOUD` indicator — means the hybrid
architecture is visible, not claimed. You can watch it flip when a long input escalates.

---

## How we built it

**Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS 4**, deployed as a
static export to **Firebase Hosting**.

The most consequential decision was that **there is no backend**. Every Firebase service is
called directly from the browser SDK, so the whole application runs on the free no-cost plan
with no server, no API routes and no Cloud Functions. A server would have added a billing
account, a deployment pipeline and a class of failure we had no time to debug — for a feature
whose entire premise is that the sensitive data must not travel.

The hybrid split comes from the **Firebase AI Logic SDK**. One `generateContent()` call, four
modes:

```ts
const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,   // or PREFER_IN_CLOUD
  inCloudParams: { model: "gemini-3.8-flash", generationConfig: { responseMimeType: "application/json" } },
  onDeviceParams: { createOptions: { responseConstraint: schema } },
});
```

The SDK reports which runtime actually served the request on `response.inferenceSource`, and that
is what drives the badge. Cloud and on-device parameters are configured side by side, so a mode
switch is a one-line change rather than a separate code path.

On top of that: **App Check** (enforced for AI Logic, with debug tokens for local development),
**anonymous Auth**, **Firestore** for the privacy receipts, and **Remote Config** for flipping
the default model and mode without a release.

The parser is the part we spent the most time on, and it is deliberately paranoid: the model is
asked to return the **exact substring** it found, and we locate that string in the source
ourselves. We never apply model-supplied character offsets to the user's text. A confused model
can therefore fail to find something — but it cannot mask the wrong characters.

---

## Challenges we ran into

**Chrome would not let the on-device model start, and the error was misleading.** The first
`LanguageModel.create()` failed with `NotSupportedError: The device does not have enough disk
space to initialize the on-device model` — on a machine that was genuinely nearly full, but with
a ~4 GB model already downloaded. The gate is not the model size: Chrome requires **~22 GB
free** on the profile volume as headroom, to cover a download staging copy, a version rollover
that keeps the old model live while the new one is unpacked, and the temporary space that makes
the swap atomic. We freed about 29 GB and the probe still returned `unavailable`, because
Chrome's optimization-guide service **caches that disk check for the lifetime of the process**.
Only a browser restart re-evaluated it. That restart — after an hour of reclaiming space that
should have worked — was the single most instructive bug of the project.

**Nobody documents which JSON Schema Gemini Nano actually honours.** The Chrome Prompt API
supports `responseConstraint`, but the documentation only ever demonstrates a boolean, and our
schema is an array of objects — the hard case. Rather than gamble, we designed for failure:
the on-device prompt asks for `{"quote": ..., "type": ...}` pairs, and our parser locates each
quote in the source text. The schema is an optimisation, not a dependency. The parser also
handles the model returning bare text, a truncated array, or trailing commas, because a
malformed response should degrade to "found less", never to "masked the wrong thing".

**Latency is bimodal.** The first prompt on a cold model takes ~98 seconds; warm prompts run
in 1–7 seconds. Both numbers are honest and both are in the UI, because a demo that stalls for
a minute and a half with no explanation is worse than one that says what it is doing.

**App Check became mandatory.** Firebase began auto-enforcing App Check for AI Logic on
2 November 2026 — six days before we started. It is the right default, but it means a local
development build cannot reach the cloud tier until a debug token is registered, and that
debug token must stay out of the repository.

**We could not inspect our own browser.** Chrome 136+ refuses to expose a remote-debugging port
on the default profile, so we built a small CDP probe against a separate profile to test the
Prompt API directly. Without it we would have been guessing at the machine's real capability
from the outside.

---

## Accomplishments that we're proud of

**We made the constraint into the product.** The strongest thing here isn't a detection model —
it's the argument that made the architecture necessary. "You can't detect a secret by uploading
it" is a sentence that justifies the whole build, and it turned "why hybrid?" from a
philosophical question into a technical one.

**The hybrid split is real and observable.** The badge reads `ON DEVICE` or `IN CLOUD` based on
the SDK's own `inferenceSource`, not on our guess. We can demo it live: a short paste stays
local, a long one escalates with a notice, and the network can be pulled to prove the local
path is genuine.

**The most sensitive data never has a copy.** The Firestore receipt stores counts and model
metadata and nothing else. The architecture makes it *impossible* to leak the scanned text
through our own telemetry, because we never send it anywhere.

**Zero backend, zero cost.** We shipped a full-stack-feeling application on the free plan, with
no server to run, no billing account to set up, and no API key to protect — because every
service is reached directly from the browser. That was a deliberate risk trade, and it paid.

**We kept the deterministic tier.** Most AI demos would hand everything to the model. We didn't,
because a rule that matches `AKIA[0-9A-Z]{16}` is more reliable than any model, costs nothing,
and runs before the model is even loaded. The model handles what rules genuinely cannot.

---

## What we learned

**Hybrid is a necessity, not a compromise.** We went in expecting on-device to be a nice
feature we would bolt on. It turned out to be the only thing that made the product coherent.
Not "we use both because the hackathon asked" — but "this data cannot leave, and here is the
architectural consequence."

**Never trust a model's coordinates.** The instinct was to have the model return start/end
indices. We changed that. Models are good at *finding* things and bad at *counting characters*,
so we ask for the text and locate it ourselves. This one design decision removed an entire
class of silent, dangerous failures.

**The hard part is the fallback path, not the happy path.** Almost all of our engineering time
went into: what happens when the model is unavailable, when the schema is ignored, when the
input is too long, when the browser has no model, when the network is off. The demo path works
in an afternoon. The demo path *not falling over* took a week.

**A browser's AI availability is a product surface, not a developer detail.** Whether the model
is `available`, `downloadable`, or `unavailable` changes what the user can do, and the app has
to tell the truth about it. We treat the availability state as something to design for, and we
surface it rather than silently falling back to the cloud — a silent fallback is exactly the
kind of thing this product exists to prevent.

---

## What's next for REDACT

**A browser extension.** The real workflow is "I'm about to paste this somewhere" — which
happens in the browser, not in our app. An extension that watches the clipboard and offers to
scan before you paste would catch the moment, not just the paste.

**Team policies and a shared allowlist.** Secret detection is only half the problem; teams also
need to say *which* patterns are forbidden for them, and to enforce it consistently. That's a
Remote Config-driven rules layer plus a shared receipt view: "here's what our org leaked this
month," without storing what it was.

**Beyond text.** The on-device model accepts image input, and screenshots of terminals,
Slack threads and whiteboards are a large and growing share of real secret leaks. The
architecture already supports it — the current version just doesn't use it yet.

**Stronger on-device detection.** The model currently runs a general prompt. A smaller,
purpose-built prompt with few-shot examples, plus a locally cached copy of the team's own
patterns, should meaningfully improve recall without sending a byte off the machine.

**Enterprise deployment.** A self-hosted rules layer, an audit export, and an air-gapped
option for organisations that cannot use a cloud model at all — the on-device tier is already
the whole product for them, and the cloud tier becomes an opt-in accelerator rather than a
requirement.
