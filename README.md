# REDACT

**A paste-box that finds secrets in your text with a local AI model — before you send it to an AI.**

Live: **[redact-fdd1a.web.app](https://redact-fdd1a.web.app)** · Built for the
[#BuildHybridAI 2026](https://buildhybridai.devpost.com) hackathon (Firebase AI Logic).

---

## The problem

Every "paste this into ChatGPT to fix it" workflow pushes source code, credentials and customer
data into a third party's inference pipeline. The numbers are not theoretical: **29 million secrets
were exposed on GitHub in 2025**, AI-assisted commits leaked at roughly **twice** the rate of
hand-written ones, and **65% of the Forbes AI 50** had leaked secrets on public repositories.

The existing tools — Presidio, GitGuardian — are server-side, regex-shaped and developer-only. But
the reason they are server-side is the wrong reason, and nobody had fixed it.

> **You cannot detect a secret by uploading it.** If the secret is already in the request, the
> detection *is* the leak.

That constraint is why on-device inference here is load-bearing rather than decorative. The
hybrid split is not a checkbox the hackathon asked for — it is the only architecture that
satisfies both "find the secret" and "the secret stays here."

## What it does

Paste a block of text. REDACT finds everything sensitive in it and shows you, in place, before you
send it anywhere.

**Three detection tiers, running in order:**

1. **Deterministic (instant, always local).** A rule pass for things with a fixed shape: AWS
   access keys, GitHub/OpenAI/Slack tokens, JWTs, private key blocks, bearer tokens,
   credential-bearing URLs, email addresses, IBANs and Luhn-checked card numbers. Caught with
   certainty, in microseconds, no model involved.
2. **Field-label tier (deterministic, always local).** A value written under a known label
   (`FULL NAME:`, `EMAIL:`, `HOME ADDRESS:`, `API KEY:`) is covered whatever the model happened to
   notice that day. The label itself is never covered. This tier exists because the on-device
   model's recall is non-deterministic — the same form read twice has given six spans once and
   three the next time — and **coverage that depends on model recall is coverage that comes and
   goes.**
3. **On-device AI (local).** Gemini Nano running inside Chrome handles what rules cannot: personal
   names, employers, addresses, contextual phrasing ("my supervisor is Marcus Webb"). This is where
   semantic judgement is needed, and where a server would be fatal.

**Escalation.** When the text genuinely exceeds the on-device model's context window — or when you
explicitly ask — the scan goes to `gemini-3.8-flash` through the Firebase AI Logic SDK. REDACT
says so on screen, and prints exactly how many characters went out.

**The badge.** A live `ON DEVICE` / `IN CLOUD` indicator driven by the SDK's own
`response.inferenceSource`, not by our guess. You can watch it flip when a long input escalates.

**The receipt.** Every scan ends with a line reading `ON DEVICE · 0 CHARS SENT · N COVERED · N.N S`.
On device it reads zero sent; in the cloud it reads the exact number. Nothing is left for you to
infer. Nothing about your text is stored — the receipt is generated in the page and discarded when
you close the tab.

**A second opinion.** "Ask the cloud too" runs the other tier against the same text and reports the
delta — the spans the device missed — so the cost of staying local is visible rather than assumed.

**Pictures.** `/image` reads a screenshot with a self-hosted OCR engine (tesseract.js, running in a
worker in your browser), scans the extracted text through the same tiers, and draws bars over the
original words. The picture itself never reaches a server, in any tier.

## Tech

| | |
|---|---|
| Framework | Next.js 16.4.6 (App Router), React 19.3.1, TypeScript 5.9.3, Tailwind CSS 4.3.5 |
| AI | Firebase AI Logic (`firebase/ai`) — Gemini Nano on device, `gemini-3.8-flash` in the cloud |
| OCR | tesseract.js 7.0.0, self-hosted in `public/` — no CDN, no upload |
| Backend | **None.** Static export (`output: 'export'`) → Firebase Hosting. No server, no API routes, no Cloud Functions |
| Plan | Firebase Spark (free, no credit card) |
| Tests | Vitest — 96 unit tests over the scan pipeline, rules, parser, OCR and rewriter |

The no-backend decision is load-bearing: it means the whole app runs on the free plan, there is no
server to run, no billing account to set up, and no API key to protect — because every Firebase
service is reached directly from the browser.

## Architecture notes

**The model is asked for text, never for coordinates.** Models are good at *finding* things and bad
at counting characters, so the prompt asks for the exact quoted substring and the parser locates it
in the source itself. We never apply model-supplied offsets to your text. A confused model can
therefore fail to find something — but it cannot mask the wrong characters. The same principle
applies to redaction decisions: the model is never the judge of its own rewrite.

**Coverage never depends on the model.** The deterministic tiers run first and always. A field
value under a known label is covered because the form says so, not because a small model noticed
it this time.

**Degrade, don't break.** No Gemini Nano? Safari, Firefox, or a quota-exhausted cloud tier — the
app still scans, still says which tier actually ran, and labels a pattern-only result as a
*partial scrub* rather than presenting it as complete.

**App Check is enforced** (reCAPTCHA Enterprise). The debug token used for local development is
compiled out of production builds, and `npm run build` fails if it ever appears in the bundle
(`scripts/check-bundle-secrets.mjs`).

## Running it locally

Requires Node 20+.

```bash
git clone git@github.com:Stargnite/REDACT.git
cd REDACT
npm install
cp .env.example .env.local    # fill in the Firebase web config
npm run dev
```

`.env.local` — every variable is documented in `.env.example`:

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web config. Public values, not secrets — a browser app cannot hold one |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | App Check, reCAPTCHA Enterprise. Must be set **before** `npm run build` |
| `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN` | Local development only. Production builds ignore it entirely |
| `NEXT_PUBLIC_FIREBASE_CLOUD_MODEL` | The cloud model, default `gemini-3.8-flash` |

The app degrades to patterns-only if Firebase is not configured, so you can work on the UI with an
empty `.env.local`.

### The on-device tier

The local tier needs Gemini Nano in **your own Chrome**:

- Chrome 158+ on macOS, with `chrome://flags/#prompt-api-for-gemini-nano` enabled if the API is
  not exposed by default.
- ~4 GB for the model and **~22 GB free disk** — Chrome refuses to initialise it below that, and
  caches the disk check for the lifetime of the process, so a browser restart is required after
  you free space.
- Check it in DevTools → Console: `await LanguageModel.availability()` should return
  `"available"`.

Safari and Firefox have no Gemini Nano. For those browsers the cloud tier is the only option, and
the app says so rather than pretending.

### Tests

```bash
npm test        # 96 unit tests
npm run typecheck
npm run build
```

## Deploying

Static export to Firebase Hosting:

```bash
npm run build
firebase deploy --only hosting --project redact-fdd1a
```

`NEXT_PUBLIC_*` values are inlined into the bundle at build time, so `.env.local` must be filled in
**before** `npm run build` — there is no runtime environment on a static host.

## Repo layout

```
app/            routes: /, /scan, /image, /how-it-works, /privacy
components/     scan, image and site UI
lib/            the scan pipeline: patterns, labels, model runner, parser, offsets, OCR
public/         self-hosted tesseract.js + tessdata (no CDN, no upload)
scripts/        build-time secret check
docs/           build plan, design system, setup and demo checklists, project write-up
```

`docs/` carries the long-form material: `REDACT_BUILD_PLAN.md` (architecture and risks),
`REDACT_DESIGN_SYSTEM.md` (the visual contract), `PRE_DEMO_TEST_CHECKLIST.md` (the accuracy corpus
and failure-mode script), `SETUP_CHECKLIST.md` (everything only a human can do), and
`ABOUT_THE_PROJECT.md` (the hackathon write-up: inspiration, challenges, lessons, what's next).

## License

Apache-2.0. See [LICENSE](LICENSE).
