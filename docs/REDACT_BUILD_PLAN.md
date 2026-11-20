# REDACT — Build Plan (v2, Next.js stack)

**Deadline:** Mon 30 Nov 2026, 2:00 PM PT · **Today:** Fri 20 Nov 2026 · **10 days, solo, web only**

Everything below is verified against the live npm registry and current Firebase/Next docs
(as of 20 Nov 2026). Nothing is built yet — this is the plan for approval.

---

## 1. Stack — exact versions (from npm registry, 20 Nov 2026)

| Package | Version | Why |
|---|---|---|
| `next` | **16.4.6** | Current stable. App Router, Turbopack, static export supported (docs updated 6 Aug 2026). Requires Node ≥ 20.9 — we have **Node v24.14.0** ✓ |
| `react` / `react-dom` | **19.3.1** | Peer dep of Next 16 (`^18.2.0 \|\| ^19.0.0`) ✓ |
| `typescript` | **5.9.3** | *Not* 7.0.2. TS 7 is the new native compiler; too fresh for a 10-day sprint. 5.9.3 is the newest 5.x and is what Next 16 is tested against |
| `tailwindcss` | **4.3.5** | v4 — CSS-first config, no `tailwind.config.js` needed, `@tailwindcss/postcss` plugin |
| `firebase` | **13.4.0** | Ships the AI Logic SDK at the `firebase/ai` subpath ✓ (verified in `package.json` exports) |
| `@firebase/ai` | **3.1.0** | The AI Logic SDK itself, pulled in transitively. Public types verified |
| `firebase-tools` | **15.37.0** | CLI for Hosting deploy, App Check, Emulator |
| `zod` | 4.6.7 | Optional — validating the Firestore privacy-receipt write. Cut if time is tight |

**No component library.** A hand-built Tailwind UI looks better to judges than a shadcn default,
and a custom design costs ~2 h versus ~4 h of fighting library defaults.

**No test framework beyond Vitest** (unit tests for the regex pass and the tolerant JSON parser).
No Playwright — a manual test matrix is enough for 10 days.

---

## 2. Architecture

```
┌─────────────────────────── Browser (all of it) ───────────────────────────┐
│                                                                            │
│  Next.js 16 App Router, static export ('use client' where needed)          │
│                                                                            │
│    ┌──────────────┐   ┌────────────────┐   ┌───────────────────────────┐   │
│    │  Editor UI   │──▶│  scan.ts       │──▶│  Tier 0  regex.ts        │   │
│    │  results,    │   │  orchestrator  │   │  AWS/GH/OpenAI keys, JWT  │   │
│    │  badges      │◀──│  merge+dedupe  │◀──│  private keys, emails    │   │
│    └──────────────┘   └────────────────┘   └───────────────────────────┘   │
│                                       │                                    │
│                    ┌──────────────────┴───────────────────┐                │
│                    ▼                                      ▼                │
│         ┌────────────────────┐              ┌────────────────────────┐    │
│         │  firebase/ai       │              │  firebase/ai           │    │
│         │  ONLY_ON_DEVICE /  │              │  PREFER_IN_CLOUD /     │    │
│         │  PREFER_ON_DEVICE  │              │  ONLY_IN_CLOUD         │    │
│         │  → Gemini Nano     │              │  → gemini-3.8-flash    │    │
│         │  (Chrome, local)   │              │  (Firebase AI Logic)   │    │
│         └────────────────────┘              └────────────────────────┘    │
│                    │  nothing leaves           │  text leaves device    │
│                    ▼                          ▼                         │
│         inferenceSource = "ON_DEVICE"   inferenceSource = "IN_CLOUD"      │
│                                                                            │
│    ┌──────────────────────────────────────────────────────────────────┐    │
│    │  firebase/firestore  ·  firebase/auth  ·  firebase/app-check     │    │
│    │  firebase/remote-config   (all called directly from the client) │    │
│    └──────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                  Firebase Hosting (static `out/`) — free Spark plan
                  Firestore · Auth · App Check · Remote Config — free Spark
```

### The one architectural decision that matters: **there is no backend**

Everything REDACT does runs in the browser. The Firebase services are called **directly from
the client SDK** — no Cloud Functions, no server, no API routes. That means:

- **No Blaze plan, no credit card.** Spark (no-cost) covers Hosting (10 GB / 360 MB per day),
  Firestore (1 GiB, 50k reads/day, 20k writes/day), Auth (50k MAU), Remote Config (100k
  fetches/day) and App Check. Only **Cloud Functions requires Blaze** — and we don't use it.
- **Static export instead of a server.** `output: 'export'` in `next.config.ts`. Next 16 fully
  supports it; the only things we lose are Server Actions, middleware, dynamic routes and ISR,
  none of which a client-side AI scanner needs.
- **Firebase App Hosting was rejected**: it requires Blaze *and* a GitHub App authorization
  *and* a live branch — three setup steps for SSR that adds nothing, since on-device inference
  is client-side by definition.

**Upgrade path if we later want a server:** flip to Blaze, add a `functions/` folder, drop
`output: 'export'`. The client code is unchanged because it already talks to Firebase services
directly.

---

## 3. Frontend — pages

| Route | Purpose | Rendering |
|---|---|---|
| `/` | **Marketing landing page.** Hero, the problem (AI tools leak your secrets), the one-line pitch, a live "runs on-device by default" indicator, CTA into `/scan`. Also where the video's opening shot comes from | Static + one client component for the live availability check |
| `/scan` | **The scrubber.** Paste box, Scan button, mode toggle, highlighted results, mask/accept per finding, "Copy redacted", inference badge, live byte-privacy meter | Client (`'use client'`) |
| `/how-it-works` | The hybrid architecture explained in plain English — this is the page judges read. Diagrams, the tier table, "why on-device first" argument | Static |
| `/privacy` | Exactly what is stored, what is never stored, what leaves the device. Links to the live privacy receipt | Static |
| `/receipt/[id]` | A single privacy receipt as a shareable link. `generateStaticParams` is not possible (receipts are runtime data), so this is **cut from scope** — see cut list | — |

## 4. Frontend — components

| Component | Responsibility |
|---|---|
| `Editor` | Controlled textarea, char count, paste/drop, sample-text loader, "Scan" action |
| `ModeToggle` | **Auto · On-device only · Cloud only** → maps to `InferenceMode` |
| `ResultsPane` | Renders the source text with highlight overlays; each finding is a span |
| `FindingChip` | Type badge, masked/unmasked toggle, accept/reject, confidence, reason |
| `InferenceBadge` | Shows `response.inferenceSource` → `ON_DEVICE` / `IN_CLOUD` + latency + which model |
| `EscalationNotice` | "Input exceeded the on-device context window — escalated to cloud" with the real numbers |
| `PrivacyMeter` | "0 bytes left your device" live counter |
| `ReceiptPanel` | The write-only Firestore receipt (metadata only) |

## 5. Core library (`src/lib/`)

| Module | Responsibility |
|---|---|
| `firebase.ts` | `initializeApp`, **App Check init first** (debug token before `initializeAppCheck`), Auth (anonymous sign-in), Firestore, Remote Config. Env-driven config, no secrets in the repo |
| `ai.ts` | `getAI(app, { backend: new GoogleAIBackend() })` + `getGenerativeModel(ai, { mode, inCloudParams, onDeviceParams })`. Exposes `scanOnDevice()`, `scanCloud()` and the four `InferenceMode` values |
| `regex-rules.ts` | The deterministic Tier 0 patterns (~15 rules) with per-rule severity and a `mask()` function |
| `model-prompt.ts` | The on-device and cloud prompts + the JSON schema |
| `parse-findings.ts` | **Tolerant parser** — see the risk section, this is the most important file in the app |
| `scan.ts` | The orchestrator: tier 0 → tier 1 → (conditional) tier 2 → merge → dedupe → sort |
| `merge.ts` | Span overlap resolution and de-duplication |
| `redact.ts` | Applies the accepted masks to produce the final text |
| `types.ts` | `Finding`, `FindingType`, `ScanResult`, `PrivacyReceipt` |
| `estimateTokens.ts` | Character-ratio estimator for the escalation meter (the on-device token count is **not** reliable — see risks) |

---

## 6. Backend — what actually has to exist

| Thing | Status | Plan requirement |
|---|---|---|
| Cloud Functions | **Not used** | Would require Blaze |
| REST API | **Not used** | All client → Firebase SDK |
| Server Actions | **Not used** | Blocked by static export |
| Firestore collection `receipts` | **Used** | Metadata-only records: `{ id, ts, charCount, findingCounts, inferenceSource, model, durations, appVersion }`. **Never** the scanned text, never the secrets |

### Supabase — permitted, but not recommended, and never alongside Firestore

Supabase works fine as a Postgres host for a Firebase project, and nothing in the hackathon rules
forbids it. But it is the wrong call here for five reasons:

1. **It duplicates what Spark already gives free.** Firestore (1 GiB, 50k reads/day) and Supabase
   Postgres both do the same job for a receipt table that will hold a handful of rows per scan.
2. **It adds a second vendor to a Firebase AI Logic submission.** The judges are scoring a
   *Firebase* product. A second database provider dilutes the story rather than strengthening it.
3. **It reintroduces exactly the risk Spark removes.** Supabase needs a project, an API key, a
   service-role key, and — for anything beyond the anon key — a server-side hold of that secret.
   Our whole point is that no server and no secret ever exists.
4. **It adds deploy steps and a failure surface** with ten days left.
5. **The receipts table is optional anyway.** If Firestore were unavailable, the correct fallback is
   to drop persistence entirely and keep the receipt in `localStorage` — the scrubber still works.
   The database is a receipt, not a dependency.

**The one exception:** if you already have a Supabase project you trust and would rather not touch
Firebase Auth/Firestore, then use Supabase *instead of* Firestore — never both, and never a
Supabase function in front of it. That would be a scope change, so it would need a re-plan before
build. As things stand the plan stays: **no backend, Firestore only, metadata only.**

---

## 7. Firebase project setup — what the CLI now does vs. what stays in the console

`firebase-tools@15.37.0` is installed globally (20 Nov 2026), which moves most of the setup off
your keyboard. **You still have to be logged in** — `firebase login` opens a browser OAuth window
and is the one step I cannot do for you. Everything else is split by whether the CLI supports it.

### 7a. CLI-automatable (I run these once you are logged in)

| Step | Command |
|---|---|
| Create the project | `firebase projects:create redact-local --display-name "REDACT"` |
| Create the web app | `firebase apps:create WEB redact-app` |
| Fetch the web config | `firebase apps:sdkconfig WEB redact-app` → writes `firebase-config.json` |
| Create the Firestore database | `firebase firestore:databases:create --location=us-central "(default)"` |
| List databases / confirm region | `firebase firestore:databases:list` |
| Create the App Check debug token | `firebase appcheck:debugtokens:create --app <appId>` |
| Read Remote Config (if any) | `firebase remoteconfig:get` |
| Hosting + deploy | `firebase init hosting` then `firebase deploy --only hosting` |

### 7b. Console-only — steps I cannot script (~20 minutes total)

These are the ones that need a real browser session, a paste from a Google-issued page, or a
payment-policy click.

1. **AI Services → AI Logic → Get started** → choose **Gemini Developer API**. This is the
   free-tier path (Agent Platform / Vertex AI is the paid one and would require Blaze). The setup
   flow auto-enables **App Check for AI Logic** — verify under **Security → App Check → APIs**
   that it reads *Enforced*.
2. **App Check → reCAPTCHA v3** → register the site key + secret key. Add **two** domains:
   `localhost` and your future `*.web.app` domain. (Do **not** add localhost to the reCAPTCHA
   *allowed domains* list — the docs explicitly say not to.)
3. **Auth → Sign-in method → Anonymous** → enable. There is no CLI command for this.
4. **Project settings → General** → confirm the project is on the **Spark** plan and that no
   billing account is linked.
5. **App Check → your web app → the debug-token row** → paste the token that
   `appcheck:debugtokens:create` printed into `.env.local` as
   `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN`. **Not committed.** A literal token string does not
   expire; the literal `true` does.
6. **Remote Config** → if the console shows the project is not yet initialised, publish an empty
   template once. (Fetching an empty template is harmless either way.)

**Keys and secrets that live only in `.env.local`, never in git:**
`NEXT_PUBLIC_FIREBASE_*` (7 config values), `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN`.

---

## 8. Deployment

```bash
npm run build          # next build → out/  (static export)
firebase deploy --only hosting
```

- Live URL: `https://<project-id>.web.app` — free subdomain, works on Spark.
- `firebase.json`: `{ "hosting": { "public": "out", "ignore": [...], "headers": [...] } }`
- `trailingSlash: true` in `next.config.ts` so Firebase serves `/how-it-works/` →
  `out/how-it-works/index.html` with no rewrite rules.
- One more thing: **`npm run dev` won't have App Check working** unless the debug token is set.
  So during development the *cloud* tier will 401 until step 5 is done. Do step 5 early.

---

## 9. Testing

| What | How | When |
|---|---|---|
| Regex rules | Vitest unit tests, ~25 cases incl. false-positive checks | Day 2 |
| Tolerant JSON parser | Vitest, fed 6 hand-written malformed model outputs | Day 2 |
| Merge/dedupe | Vitest | Day 2 |
| On-device structured output | **1-hour spike in a real browser** | Day 2 — see risks |
| End-to-end | Manual matrix: 6 sample texts × 3 modes × on/offline | Day 6 |
| Build + deploy | `npm run build && firebase deploy` | Day 7, 9 |

---

## 10. Submission artifacts (Devpost)

| Item | Notes |
|---|---|
| **Live web app URL** | The `*.web.app` URL — must work in a browser you don't control |
| **Public GitHub repo** | Apache-2.0 LICENSE, full README |
| **≤3-minute video, public YouTube link** | Script already drafted in `HACKATHON_BRIEF.md` §13.5 |
| **Write-up on Devpost** | Problem → why hybrid is *necessary* (not a checkbox) → architecture → what we'd ship |
| **Screenshots** | At least: the badge showing ON_DEVICE, and the same scan showing IN_CLOUD after escalation |

---

## 11. Risks, ranked, with the fallback for each

### R1 — On-device Gemini Nano may not honour a nested JSON schema — **highest risk**

The Chrome Prompt API supports `responseConstraint`, but the docs only demonstrate a **boolean**
schema; they do not enumerate which JSON Schema features Gemini Nano actually implements.
Our schema is an array of objects, which is the hard case.

**Mitigation baked into the design:** we never trust the model's character offsets. Instead the
on-device prompt asks for **`{"quote": "<exact substring>", "type": "<enum>"}`** pairs, and the
parser **locates each returned quote in the source text** to derive the offsets. A schema
mismatch degrades to "no findings", never to "wrong offsets applied to the wrong characters".
The parser is also tolerant: it finds the first `[...]` block, repairs trailing commas, and
falls back to per-line JSON if the model ignores the array instruction.

**Fallback ladder if the spike fails:**
1. `responseConstraint` with a *flat* schema (`{quote, type}` objects, no nesting).
2. No constraint at all — free-text JSON, parsed tolerantly (same parser).
3. Call the **raw Chrome Prompt API** (`window.LanguageModel`) for the on-device tier and keep
   `firebase/ai` for cloud only. Costs us the single-SDK elegance but not the product. This
   fallback is *good content for the README* — it shows real engineering under a deadline.

### R2 — The judge's browser won't have the on-device model

On a fresh machine `LanguageModel.availability()` is `"downloadable"`, not `"available"`. The
model is ~4 GB and Chrome needs ~22 GB free to install it.

**Mitigation:** the UI must show the true availability state and degrade gracefully to cloud
with a clear banner. Our demo machine has it working (verified today — see §12). The video
will be recorded on our machine, so the on-device path is proven on camera.

### R3 — App Check blocks the cloud tier during development

**Mitigation:** step 5 above, done on Day 1. `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` in
`.env.local`.

### R4 — Firestore security rules

Rules must require App Check **and** auth, and must reject writes containing anything that
looks like content. Simplest safe rule: allow `create` only, never `update`/`delete`, cap the
document size, and enforce `request.resource.data` shape. Reviewable in the repo — judges read
rules.

### R5 — On-device latency

Measured on this machine today: cold start 98 s, then **1–7 s** per prompt warm. The demo will
look slow if we don't show progress. **Mitigation:** a staged progress UI ("loading local
model… 98 s first time, ~2 s after"), and the video is recorded after a warm-up.

### R6 — The 9,216-token figure is wrong / not applicable

Earlier research assumed a hard 9,216-token on-device input cap. The current Chrome docs
describe **no fixed cap** — instead each session exposes `contextWindow` and `contextUsage`,
and overflow raises `QuotaExceededError` carrying `requested` and `contextWindow`.

**Mitigation:** don't hardcode 9,216. Read the real context window at runtime if the SDK
exposes it; otherwise estimate from characters and **catch `QuotaExceededError` and escalate
to cloud on the spot**. Escalation must be a *handled path*, not a crash. I'll verify which of
`contextWindow` the Firebase SDK re-exports during the spike.

### R7 — Gemini Nano context behaviour differs from what the SDK claims

The Chrome docs describe a session that preserves context and supports `append()`, while the
Firebase on-device path has been described as single-turn. **Mitigation:** REDACT issues one
prompt per scan and never uses a chat session, so both models of the API work.

---

## 12. Verified on this machine today (20 Nov 2026)

| Fact | Evidence |
|---|---|
| On-disk space gate cleared | `df` → **28 GB free** (was 2.7 GB) after clearing Yarn/npm caches and `node_modules` across `~/Desktop/wazobia-tech` |
| Chrome caches the disk verdict per process | Restarting Chrome flipped the state — the probe does not recover without it |
| `LanguageModel.availability()` | **`"available"`** (was `"unavailable"`) |
| `LanguageModel.create()` → real generation | Returns **`"READY"`** — the on-device model is genuinely live |
| Cold start | 98.7 s for the first prompt |
| Warm latency | 7.0 s → 2.6 s → 1.0 s → 2.4 s |
| `LanguageModel.create()` when warm | 45 ms |
| The real Default profile | Has the 4 GB model on disk. **Cannot be CDP-attached** (Chrome 136+ blocks `--remote-debugging-port` on the default profile), so it gets verified end-to-end through the app itself instead |

---

## 13. Cut list (drop these first, in this order, if time runs out)

1. `/receipt/[id]` shareable receipt page
2. Cloud escalation — ship on-device-only (still a valid hybrid demo if we show the mode toggle)
3. Remote Config (hardcode the model + mode instead)
4. Firestore privacy receipt (show it in the UI only)
5. The `/privacy` and `/how-it-works` pages — fold the content into the README
6. Vitest tests (keep only the parser test)

**Never cut:** the inference badge, the mode toggle, the regex pre-pass, the on-device path,
the Apache-2.0 LICENSE, the README, the video.

---

## 14. Proposed day-by-day (solo, tightened)

| Day | Date | Focus |
|---|---|---|
| **1** | Sat 21 Nov | Scaffold Next 16 + Tailwind 4 + Firebase. **Do all 9 console steps.** Build the CDP probe into a "does this browser have on-device AI?" check |
| **2** | Sun 22 Nov | **The spike**: prove on-device structured output through `firebase/ai`. Build `regex-rules.ts` + `parse-findings.ts` + unit tests. Decide R1 |
| **3** | Mon 23 Nov | `scan.ts` orchestrator + merge/dedupe + `ai.ts`. Wire the tier 0/1/2 flow |
| **4** | Tue 24 Nov | UI: Editor, ResultsPane, FindingChip, InferenceBadge, ModeToggle, escalation notice |
| **5** | Wed 25 Nov | Privacy receipt + Firestore rules + Remote Config. **Sprint 3 quota request due 10:00 AM PT today** |
| **6** | Thu 26 Nov | Manual test matrix, offline handling, error states, polish |
| **7** | Fri 27 Nov | First deploy. **No new features after today** |
| **8** | Sat 28 Nov | README, LICENSE, screenshots, write-up |
| **9** | Sun 29 Nov | Record the 3-minute video. Rehearse, re-record if needed |
| **10** | Mon 30 Nov | Final deploy, Devpost submission **before 12:00 PM PT** (2 h buffer) |

---

## 15. Decisions confirmed (20 Nov 2026)

1. **Spark plan** — no cost, no credit card. Cloud Functions are not used at all.
2. **`/` is a marketing landing page**; the scrubber lives at **`/scan`**.
3. **A fresh Firebase project** — created from scratch, no existing services to conflict.

---

## 16. Immediate next steps once you approve

The console work has been split by what the CLI can do — see §7 for the command table and
`SETUP_CHECKLIST.md` for the full out-of-repo list.

**You do (≈25 min, in this order — step 1 gates everything else):**

1. `firebase login` — browser OAuth. Nothing else works until this lands.
2. AI Services → AI Logic → Get started → **Gemini Developer API** (free tier).
3. App Check → reCAPTCHA v3 → create the key pair; add `localhost` and the future
   `*.web.app` domain. Send me the site + secret key.
4. App Check → your web app → debug token → send it to me (it goes in `.env.local`, never in git).
5. Auth → enable **Anonymous**.
6. Remote Config → publish an empty template once.

**I do (as soon as you are logged in):**

7. `firebase projects:create` → `apps:create WEB` → `apps:sdkconfig`.
8. `firebase firestore:databases:create` (production mode).
9. `firebase appcheck:debugtokens:create` → print the token for you to paste.

**I do (the build):**

10. Scaffold Next.js 16.4.6 + TypeScript 5.9.3 + Tailwind 4.3.5 + firebase 13.4.0.
11. Wire `firebase.ts`, `ai.ts`, the regex tier, the tolerant parser, the orchestrator and the UI.
12. Run the on-device structured-output spike and lock in the R1 fallback.
13. Build, deploy to Hosting, write the README and LICENSE, record the video.

Say **go** and I'll start with the scaffold while you do the console steps in parallel — the
console work doesn't block the scaffold, only the first live cloud call.
