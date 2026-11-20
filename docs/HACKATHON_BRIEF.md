# #BuildHybridAI 2026 — Curated Brief

*Compiled 20 Nov 2026. Deadline: Mon 30 Nov 2026, 2:00 PM PT. ~10 days.*

---

## 0. Decisions locked (20 Nov 2026)

| | |
|---|---|
| **Project** | **REDACT** — local-first secret & PII scrubber for text about to be pasted into any AI |
| **Team** | **Solo** — one developer |
| **Platform** | **Web app only** (Chrome + Firebase Hosting). No extension, no Android. |
| **Eligibility** | Confirmed eligible |

**Consequence of solo + web-only:** scope must be cut hard. See §13 for the ship/cut list.

---

## 0.1 Machine audit — done 20 Nov, and one blocker found

I probed this Mac directly with the Chrome DevTools Protocol against your **real** Chrome profile
(not a throwaway one). Results:

| Check | Result |
|---|---|
| Chrome version | **158.0.8127.36** — well above the 139 minimum ✅ |
| `LanguageModel` global exposed | ✅ yes |
| Secure context | ✅ yes |
| Gemini Nano model on disk | ✅ **4.0 GB already downloaded** (`OptGuideOnDeviceModel/2025.8.8.1141`) |
| Chrome labs flags enabled | **none** — fine, REDACT is text-only (multimodal flag not needed) |
| **`LanguageModel.availability()`** | ❌ **`"unavailable"`** |
| **`LanguageModel.create()` error** | ❌ **`NotSupportedError: The device does not have enough disk space to initialize the on-device model.`** |

### 🔴 The blocker

**This Mac has 2.7 GB free on a 113 GB disk (98% full). Chrome requires ~22 GB free on the profile
volume before it will initialize the on-device model.**

Without this fixed, `availability()` stays `"unavailable"`, `PREFER_ON_DEVICE` silently degrades to
cloud, and **your demo video would never show the on-device path** — which is the one thing a
hybrid-inference hackathon entry must show. Fix this first, before writing any app code.

Reclaimable without losing a single line of source code:

| What | Frees | Safe? |
|---|---|---|
| `~/Library/Caches/Yarn` | 7.3 GB | ✅ pure package cache |
| `~/Library/Caches/com.microsoft.VSCode.ShipIt` | 1.6 GB | ✅ updater cache |
| `~/Library/Caches/Google` | 1.4 GB | ✅ cache |
| `~/Library/Caches/com.anthropic.claudefordesktop.ShipIt` | 655 MB | ✅ updater cache |
| `~/Library/Caches/pnpm` + `pip` + `Homebrew` + `typescript` + `ms-playwright-mcp` + Slack ShipIt | ~1.9 GB | ✅ caches |
| **Subtotal, caches only** | **~13 GB** | ✅ zero risk, no source touched |
| `.next/` build dirs across `~/Desktop/wazobia-tech` (cremationpets, wazobia-cms, tw, wazobia-hr, cf, fournine, vt) | ~11.5 GB | ✅ regenerable with `npm run build` |
| `node_modules/` across the same repos | ~6.9 GB | ✅ regenerable with `npm install` |

Caches alone get you to ~16 GB free. Adding the `.next` dirs gets you to ~27 GB — comfortably past
Chrome's 22 GB requirement. **Do not delete `~/Desktop/wazobia-tech` itself, and do not touch
`~/Desktop/portfolio-v27`** — those are your real work.

After freeing space, re-run the probe to confirm:

```bash
node redact/scripts/probe-prompt-api.mjs 9222
```

Expect `availability: "available"` and a `reply: "READY"`. Chrome may also pull a newer model
version than `2025.8.8.1141` on first successful init.

**If you can't free the space**, see §13.4 for the fallback plan (a second machine, or the
Transformers.js local tier via `prompt-api-polyfill`).

---

## 1. The one-paragraph version

Firebase AI Logic's **Hybrid Inference SDK** gives you one API (`generateContent`) that runs
**Gemini Nano 4 on-device** when it's available and **falls back to a cloud Gemini model** when it
isn't. You pick the routing with a single `InferenceMode`. The judges score four things:
technological implementation (how well you use hybrid inference), design (is it a real product),
potential impact (a real problem, a real audience), and quality of idea (non-obvious). So the
winning project is **not** "an app with an AI button" — it's an app where *the on-device/cloud split
is the product*, and where you can *show* the judge which engine handled what.

---

## 2. What the SDK actually gives you (web / Chrome)

### 2.1 The API surface

```js
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE });
```

Four inference modes — this is the whole "hybrid" contract:

| Mode | Behaviour |
|---|---|
| `PREFER_ON_DEVICE` | Local model if available, else cloud. **The default recommendation.** |
| `ONLY_ON_DEVICE` | Local only; throws if unavailable. |
| `PREFER_IN_CLOUD` | Cloud if reachable, else local (this is the *offline* mode). |
| `ONLY_IN_CLOUD` | Cloud only; throws if unreachable. |

There is **no tunable fallback threshold** (no timeout, no confidence cut-off). Fallback is driven
purely by mode + model availability. If you want a threshold, you implement it yourself in your
routing layer.

### 2.2 Telling the user which engine answered

```js
const result = await model.generateContent(prompt);
result.response.inferenceSource; // "ON_DEVICE" | "IN_CLOUD"   (SDK >= 12.5.0)
result.response.text();
```

This one property is the backbone of the whole product. Surface it in the UI as a badge.

### 2.3 Configuration

```js
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,

  inCloudParams: {                      // cloud path
    model: "gemini-3.8-flash",
    generationConfig: {
      maxOutputTokens: 200,
      stopSequences: ["red"],
      responseMimeType: "application/json",   // or "text/x.enum"
      responseSchema: schema,
    },
  },

  onDeviceParams: {                     // on-device path
    createOptions: {
      expectedInputs:  [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      initialPrompts: [{ role: "system", content: [{ type: "text", value: "..." }] }],
    },
    promptOptions: {
      responseConstraint: schema,        // on-device schema constraint
    },
  },
});
```

Configuration is fixed for the lifetime of the instance — to change mode you create a new model.

### 2.4 Structured output on both paths

Same logical schema, two different homes:

- On-device → `onDeviceParams.promptOptions.responseConstraint`
- Cloud → `inCloudParams.generationConfig.responseSchema` + `responseMimeType`

```js
import { Schema } from "firebase/ai";
const schema = Schema.object({
  properties: {
    spans: Schema.array({
      items: Schema.object({
        properties: {
          type:    Schema.enumString({ enum: ["SECRET","EMAIL","PHONE","PERSON","ADDRESS","MEDICAL_ID"] }),
          value:   Schema.string(),
          start:   Schema.number(),
          end:     Schema.number(),
          reason:  Schema.string(),
        },
        required: ["type","value","start","end","reason"],
      }),
    }),
  },
});
```

`Schema.enumString({ enum: [...] })` gives you a constrained enum on device — great for
classification tasks (urgency levels, clause types, document types, sentiment).

### 2.5 The on-device model's hard limits (this shapes your product)

| Capability | On-device (Chrome, Gemini Nano 4) | Cloud |
|---|---|---|
| Text in → text out | ✅ | ✅ |
| Streaming | ✅ | ✅ |
| Structured JSON / enum output | ✅ | ✅ |
| Image input | ✅ but **JPEG/PNG inline data only**, and behind the flag `#prompt-api-for-gemini-nano-multimodal-input` | ✅ any |
| Input size | **9,216 tokens max** | 128k+ |
| Multi-turn chat (`startChat`) | ❌ | ✅ |
| Function calling / code exec | ❌ | ✅ |
| PDF / audio / video input | ❌ | ✅ |
| Image generation | ❌ | ✅ |
| Grounding (Search/Maps) | ❌ | ✅ |
| Gemini Live API | ❌ | ✅ |
| Server prompt templates | ❌ | ✅ |

**Consequences you must design around:**

1. **No multi-turn on device.** You cannot use `startChat()` on the local path. You keep the
   conversation history yourself and re-send it on every turn, truncating to 9,216 tokens. Write
   one `ask()` helper that does this and use it for *both* paths so behaviour is identical.
2. **Long documents must go to cloud.** Anything over ~9k tokens is cloud-only by construction. This
   is the cleanest, most defensible reason to route to the cloud — use it as your primary hybrid
   justification rather than "the cloud is smarter".
3. **No function calling on device** → don't design a tool-calling agent. Design discrete,
   typed operations instead. This is *good* — discrete ops are what map cleanly onto
   structured output.
4. **Cloud-only features are a natural second tier**: image gen, TTS, Live, grounding, PDFs.

### 2.6 On-device model acquisition (the biggest UX risk)

- Chrome **139+** on desktop. (Chrome's own built-in-AI page says web Prompt API is stable in
  Chrome 148.)
- `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` must be enabled + Chrome restarted
  (needed for the multimodal path).
- Model is ~**4 GB**, downloaded separately from Chrome. Chrome requires **~22 GB free** on the
  profile volume before it will download.
- Hardware: GPU with >4 GB VRAM, **or** 16 GB RAM + 4+ CPU cores.
- First request can trigger the download and be very slow.

Check and warm it up:

```js
await LanguageModel.availability();   // "available" | "downloading" | "downloadable" | "unavailable"
```

```js
model.initializeDeviceModel((val) => {
  console.log(`Download progress: ${Math.round(val * 10000) / 100}%`);
});
```

**Read the Karrot lesson here (see §5.2):** a real production team *rejected* Gemini Nano because of
this download friction. Your app must therefore:

- Detect availability and show it **before** the user does anything.
- Offer an explicit **"Enable on-device mode"** action with progress, not a silent surprise.
- Degrade gracefully to cloud with a clear, honest badge — never pretend.
- Give the user a **manual override** (Auto / Force on-device / Force cloud). This is what lets you
  demo both paths in your 3-minute video and lets a judge without Gemini Nano still explore both.

**Optional robustness layer:** Google's ChromeLabs
[`prompt-api-polyfill`](https://github.com/GoogleChromeLabs/web-ai-demos/tree/main/prompt-api-polyfill)
exposes the same `LanguageModel` API backed by Firebase AI Logic (cloud) **or** Transformers.js /
WebLLM (local). A three-tier fallback — Chrome Gemini Nano → local Transformers.js → Firebase cloud —
means the app can stay local even on a machine that never downloaded Chrome's model, and the cloud
backend is still Firebase AI Logic. Stretch goal; don't let it block you.

---

## 3. Firebase services to use (the hackathon expects more than AI Logic)

**App Check is mandatory** — AI Logic enforces it. Debug tokens are accepted in submissions, so you
can ship with a debug token, but register it properly in the console:

1. `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;` **before** `initializeAppCheck(...)`.
2. Run on localhost, copy the token from the devtools console.
3. Firebase console → Security → App Check → Apps → overflow → **Manage debug tokens** → paste.
4. Do **not** add `localhost` to reCAPTCHA's allowed domains.

Other services the rubric and production checklist explicitly call out:

| Service | Use it for |
|---|---|
| **Remote Config** | Flip the inference mode, per-feature model routing, and strictness thresholds **without shipping a new build**. Also a `minimum_version` gate. Strongly recommended by the production checklist. |
| **Firestore** | Persist user state, shared/team policies, and the audit log (e.g. "what left the device"). |
| **Authentication** | Anonymous auth for personal use; email/Google sign-in for team workspaces. Also lets you enable App Check's *authenticated-users mode* (unauthenticated requests get `401: unauthenticated`). |
| **Firebase Hosting** | Host the demo. Strongly encouraged by the judges ("a hosted project is highly encouraged"). |
| **AI Monitoring** | Enable it in the console. Note it does **not** include local inference activity. |
| **Server prompt templates** | Cloud-only, but the production checklist recommends them over hard-coded prompts so you can change models without a release. |

Production checklist gotchas worth knowing:

- Default per-user rate limit is **100 requests/minute**.
- Pin a stable model version in production — no `-latest` aliases, no preview models.
- Restrict the API key: web → HTTP referrer restrictions; API allowlist must include
  `firebasevertexai.googleapis.com`.
- Firebase began **auto-enforcing App Check for AI Logic in every project on 2 Nov 2026**.

---

## 4. What you need from Google (quota, accounts, keys)

| Thing | Status |
|---|---|
| Firebase project | Create one now. Free. |
| Gemini Developer API key | From AI Studio. Use the **Gemini Developer API** backend (simplest, no-cost init). |
| App Check debug token | Register in console (see above). |
| **Google Account Quota** | Only needed for **image generation** and other advanced features. **Text inference is free within normal usage limits — you do not need this to build.** |

Sprint windows (quota accounts are valid only 4 days):

| Sprint | Request by | Account sent | Active |
|---|---|---|---|
| Sprint 1 | Wed Nov 11 | Thu Nov 12 | past |
| Sprint 2 | Wed Nov 18 | Thu Nov 19 | **Fri Nov 20 → Mon Nov 23, midnight PT** |
| Sprint 3 (final) | Wed Nov 25, 10:00 AM PT | Fri Nov 27 | Fri Nov 27 → Nov 30 |

→ **If you already requested a Sprint 2 quota, it is live right now (Nov 20–23).** Use it this
weekend for anything image-gen. Otherwise, request Sprint 3 by **Wed Nov 25 10:00 AM PT** at
<https://forms.gle/uPcDhaYW3iVo2AYw5> — but only one account per entrant, per project, per sprint.

Note: **Gemini 3.8 Flash TTS and 3.8 Flash-Lite TTS are free tier**, so a speech feature may not need
the quota account at all. Verify in the AI Logic console before assuming.

Free-tier models you can use with no quota account: `gemini-3.5-flash-lite` (SDK default),
`gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-4-hydrogen` (Standard/Priority/Contributor),
`gemini-3.8-flash-tts`. Image gen (`gemini-nano-banana-2.1`) is **not** free tier.

---

## 5. Inspiration projects — what they actually did (and didn't)

### 5.1 Jojo Apps & "Finnish it" (Firebase blog, Sep 2026)

Two products: **"Finnish it"** (Finnish-language YKI exam practice for immigrants) and **Jojo Apps'
Meal Planner & Grocery List** (speaks recipe steps hands-free while cooking).

- Used **Firebase AI Logic → Gemini native TTS**, called from the client.
- Audio streamed **directly to the device** as raw PCM (24 kHz, mono, 16-bit) — the app's own
  backend was removed as the "middleman".
- Impact: **zero server cost** for the speech feature, "drastically cut latency", warmer pacing.
  (No user counts or retention numbers published.)
- ⚠️ **This was cloud inference only.** No on-device model was used. Do not mistake this for the
  hybrid pattern.

### 5.2 Karrot (Android, Apr 2026) — the most instructive one

Hyperlocal peer-to-peer marketplace, **43M+ registered users** since 2015.

- Problem: after expanding into North America, **30% of users had a non-English device language**;
  translation was needed fast and at scale.
- **They tested two on-device options first and rejected both:** ML Kit Translation (quality
  insufficient) and **Gemini Nano** (the model download requirement — exactly the friction in §2.6).
- Settled on Firebase AI Logic calling the Gemini API directly from the app.
- **No backend team needed.** Proof of concept in **under 3 hours**; production in **2 weeks**.
- Results: **1 in 3** users shown the translation banner actively used it; buyers with translation
  were **2.4× more likely to start a chat** with a seller; higher purchase conversion among
  non-English users.
- Next step: Server Prompt Templates + Remote Config to iterate without app releases.

**Two lessons to steal:**
1. The hybrid split must be *justified against a rejected alternative*, not asserted. Karrot's
   honest write-up of "we tried on-device, here's why not" is exactly the "genuine understanding of
   the problem space" the rubric rewards.
2. Time-to-first-value is a feature. Karrot shipped in 2 weeks because there was no backend.

### 5.3 Free-tier project ideas the organizers posted (avoid these — they're the baseline)

1. Realtime voice and camera coach via Gemini Live API + Function Calling
2. PDF reader via gemini-3.8-flash and gemini-3.1-flash-tts-preview
3. Multiplayer AI Tabletop Game Master via gemini-3.5-flash-lite + gemini-3.1-flash-tts-preview

Also note the hackathon's own example ("a notes app that summarizes on-device offline and hands
long documents to the cloud") — that's the *reference* implementation. Building a notes app is
building the example.

---

## 6. The shortlist — 5 candidate projects

Each is scored on the four judging criteria and, critically, on **why on-device is a requirement
rather than a nice-to-have**. That last question is the whole game.

---

### ★ 1. REDACT — "the last step before you paste it into any AI"

**One-line:** A local-first scrubber that finds secrets and PII in anything you're about to paste
into ChatGPT, Copilot, Gemini or an LLM API — and it does it *on your machine*, so the secret
you're hunting never travels to find out whether it was a secret.

**The problem, with evidence**
- GitHub: **39M secret leaks in 2024**; a new secret appears in public code **roughly every two
  seconds**; leak volume **doubling yearly for three years** (GitHub, Oct 2026).
- GitGuardian: **29M secrets leaked on GitHub in 2025**; **AI-assisted commits leak at ~2× the rate**
  of normal commits (Mar 2026).
- GitGuardian/Copilot research: of 8,127 Copilot suggestions, **2,702 valid secrets** (33.2%).
- Apiiro (Nov 2026): **2,539 real secrets across 1,994 public repos**, attributed to coding agents
  publishing without the developer realising.
- Wiz (Nov 2025): **65% of the Forbes AI 50** had leaked verified secrets on GitHub.

**Why the existing tools don't cover it.** GitHub secret scanning and GitGuardian are *repo-side*:
they catch secrets after they've been committed, and they're for dev teams. Microsoft Presidio is
the closest to a PII tool but it's **rule/regex + spaCy based, not semantic** (it misses
context-dependent PII like *"he lives in a town near the capital"*), it **requires you to run a
Python server**, and it is aimed at engineers. The gap: **a free, browser-local, semantic,
zero-install scrubber for the millions of people who aren't engineers** — support agents pasting
customer records, HR staff, clinicians, teachers, journalists, and every dev who pastes a stack
trace.

**Hybrid design (this is the heart of it)**

| Stage | Engine | What it does | Why that engine |
|---|---|---|---|
| 1. Detect | **On-device** (Gemini Nano) | Extract every sensitive span → structured JSON: `{type, value, start, end, reason}` with a constrained enum for `type` | **You cannot find a secret by uploading it.** Detection must be local or the tool is useless. Also: instant, free, offline, works on a plane. |
| 2. Review | On-device | Highlight spans in the text, let the user accept/reject each one, mask with `[REDACTED:EMAIL]` | Interactive editing is local UI work — no model needed. |
| 3. Escalate | **Cloud** (`gemini-3.8-flash`) | Only for what the device couldn't do: documents over 9,216 tokens, PDFs, contextual PII the local model missed, and a "safe-to-share summary" of what's left | Hard limits of the on-device model (context window, no PDF input) — a *structural* reason to route up, not "the cloud is smarter". |
| 4. Prove | — | A **privacy receipt**: exactly what was processed on-device, what (if anything) left, and a copyable redacted payload | Turns a privacy claim into a product feature. |

**Firebase products used (all of them, legitimately)**
App Check (mandatory) · Remote Config (per-workspace strictness policy, model routing, toggle the
local stage on/off) · Firestore (team redaction policies, the privacy receipt log, shared templates)
· Authentication (anonymous for individuals; Google sign-in for teams) · Hosting.

**Why it should win**
- **Technological Implementation**: it's the cleanest possible demonstration of hybrid inference —
  an operation that *must* be local, a second that *must* be cloud, with a third that streams.
  Structured output on both paths, an enum-constrained on-device model, visible `inferenceSource`
  badges, and a manual override so a judge can force each path.
- **Potential Impact**: a hard, quantified problem with a specific audience and a number attached.
- **Quality of the Idea**: the insight — *the detection has to happen before the data moves* — is
  genuinely non-obvious and is a correct technical statement, not a marketing line.
- **Design**: the privacy receipt and the accept/reject UI make it a product, not a demo.

**Risks**
- Dev-centric framing can read as narrow → widen the audience in the pitch (support/HR/health/
  legal all paste sensitive text) and ship a "redaction templates" feature (HIPAA-style, GDPR-style)
  that non-devs can pick.
- A judge may say "secret scanning exists" → your answer is the *before-paste, semantic,
  zero-install, offline* gap. Put a one-line competitor table in the README.
- On-device model detection quality on short text is the thing to test **first**. If Gemini Nano is
  weak at this, add a **deterministic regex pre-pass** (which you want anyway for API-key formats)
  and let the model catch the *semantic* PII. Hybrid within hybrid.

**Stretch:** a Chrome extension that scans the page you're currently on and offers to redact before
copy. (See the risk note in §8.)

---

### 2. TRIAGE — offline-first intake triage for community health workers

**One-line:** A web app for community health workers and rural clinic staff that triages patients
**with no network and no patient data leaving the device**, and escalates to the cloud only when
it's genuinely needed.

**Problem:** CHWs work in low-bandwidth, intermittent-connectivity settings with paper intake.
The privacy bar around patient data (HIPAA, national health-data laws) means "just upload it" is
often not an option. Offline-first digital triage tools are a real, donor-funded category.

**Hybrid design**
- **On-device**: Gemini Nano reads a short intake note → returns a **constrained enum urgency
  level** (`EMERGENCY | URGENT | ROUTINE | NON_URGENT`) plus a likely category and the single
  reason for that level. 9,216 tokens is plenty for an intake note. Runs with the network off.
- **Cloud** (`gemini-3.8-flash`): ambiguous cases, generating a referral summary, translation for
  the patient, and protocol lookups the device doesn't have.
- **Firestore**: offline write queue with sync-on-reconnect; Remote Config carries the local
  protocol and urgency thresholds per region (updated centrally, no app release — a real
  requirement in health).

**Why it works:** the *airplane-mode demo* is visceral and instantly communicates the value. The
discipline of "triage prioritisation support for a clinician, not diagnosis" is an honest framing
that judges respect.

**Risks:** medical-advice scrutiny; on-device triage quality is the crux; needs clinical
credibility a 10-day team can't fully establish. **Strongest if your team has healthcare or public
health background** — otherwise pick REDACT.

---

### 3. CLAUSE — local-first contract & lease reader for renters and small businesses

**One-line:** Point it at a lease, a contractor agreement or an invoice; it classifies every clause
and extracts the numbers that matter **on your device**, then gives you a plain-English risk
readout when it can go to the cloud.

**Problem:** tens of millions of people sign rental and service agreements they don't fully
understand. Existing AI legal tools are cloud-only, paid, and upload the whole document — and a
lease contains exactly the PII (names, addresses, employer, salary, bank details) users are least
comfortable uploading. There's no free local option.

**Hybrid design**
- **On-device**: classify each clause into a **constrained enum** (`termination | liability |
  deposit | renewal | payment | confidentiality | governing_law | indemnity | other`) and extract
  structured fields (dates, amounts, notice periods, party names) as JSON. This is *exactly* the
  shape Gemini Nano is good at — discrete typed extraction.
- **Cloud**: risk analysis and negotiation talking points for long or unusual documents; a plain
  English rewrite; comparison against standard terms.
- Firebase: Firestore for a **clause-library** the team curates (the knowledge base that makes the
  on-device classifier good), Remote Config for the active rule set.

**Why it's good:** the on-device/cloud boundary is legible to any judge in 10 seconds — "we read
the clause types on your laptop; we only send the hard reasoning to the server." The clause library
in Firestore is a genuine product asset, not a mock.

**Risks:** crowded space (there are legal-AI startups); the differentiator must be
*local + free + structured*, and you must be honest that it's not legal advice.

---

### 4. DOCUFILL — private document & form assistant (immigrants, benefits, banking)

**One-line:** Photograph an ID, a passport, a bank statement or a benefits form; the app reads it,
checks it against the form you actually need to complete, and **never sends the image of your
passport to a server**.

**Problem:** filling out official forms requires uploading identity documents to third parties.
DigiLocker, TurboTax, Inkster and similar products are cloud services; for immigration status,
benefits eligibility or banking onboarding, uploading a passport photo to a vendor is a genuine
risk. There is also a real digital-divide angle: many of these flows need connectivity and an
email account.

**Hybrid design**
- **On-device (multimodal)**: Gemini Nano takes the JPEG/PNG **directly on device**, classifies the
  document type, extracts the fields, and reports completeness against the target form's schema.
  *The image never leaves the machine.* Requires the
  `#prompt-api-for-gemini-nano-multimodal-input` flag — verify early, it's a risk.
- **Cloud**: translation of the form and instructions, and guidance on how to answer ambiguous
  fields.

**Why it works:** the privacy claim is unusually concrete and easy to demonstrate — "watch the
network tab stay empty while your passport is read." Strong impact narrative, underserved
audience, and a natural multi-platform extension (Android camera → same app).

**Risks:** multimodal-on-device is flag-gated and less battle-tested; document OCR/field extraction
quality is the hard part; you'll need realistic sample documents you have the right to use.

---

### 5. EYE — on-device image description + speech for blind and low-vision users

**One-line:** Describe what's in front of you and read it aloud — entirely on your device, offline,
for free — with the cloud used only for richer description and natural speech.

**Problem:** cloud vision and TTS for blind users means paying per use and being offline-blocked.
Screen readers are good at reading text but not at describing an image, a receipt, or a document's
layout. Meanwhile Gemini 3.8 Flash TTS is **free tier** and Gemini Nano does on-device image
description.

**Hybrid design**
- **On-device**: Gemini Nano describes the image (JPEG/PNG) → speak it with the browser's own
  `speechSynthesis` (free, local, no network, no API). Fully offline accessibility.
- **Cloud**: higher-fidelity description, follow-up Q&A about the image, and natural Gemini TTS
  voice for users who want it.

**Why it works:** the strongest *emotional* demo of the five — a screen reader user describing a
photo with the network off. Accessibility is a well-loved hackathon category and the audience is
undeniable.

**Risks:** speech quality from `speechSynthesis` varies by OS; on-device multimodal is flag-gated
again; TTS quality comparison needs care.

---

### Recommendation

**REDACT.** It has the sharpest *technical* justification for hybrid (detection must be local;
long context must be cloud), the strongest evidence base, the richest Firebase surface
(Remote Config policies, Firestore templates, Auth workspaces, App Check), and the cleanest 3-minute
demo. It also has a good fallback story: if your team has genuine healthcare expertise, TRIAGE is
the stronger pick; if you have design/multimodal strength, EYE is the most moving demo.

**Pick your platform: Web (Chrome).** The Grand Prize favours multi-platform, but a single
outstanding web app can still win, and web is where the on-device story is most legible
(`inferenceSource` + airplane mode + `initializeDeviceModel` progress). Ship web first; add an
Android surface afterwards only if you have time. **Note:** hybrid inference on Android is still
described as *experimental* by Google, and iOS requires the Apple Foundation Models API — both are
bigger lifts than web.

---

## 7. Cross-cutting design: the "Inference Ledger"

This is the thing that turns a tech demo into a product, and it applies to whichever idea you pick.
Build all four of these:

1. **A visible engine badge** on every AI output — `ON DEVICE` (green, with a lock) or `CLOUD`
   (amber, with "this left your device"). Use `result.response.inferenceSource`.
2. **A manual override** — Auto / Force on-device / Force cloud. Without it you can't demo both
   paths on demand, and a judge without Gemini Nano can't explore either.
3. **An explicit offline state.** Detect `navigator.onLine` and, when offline, use
   `PREFER_IN_CLOUD` (which falls back to *local*), not `PREFER_ON_DEVICE`. This is a genuinely
   clever use of the mode matrix and it's the thing Karrot's users would have wanted.
4. **A privacy receipt / audit log** — what ran locally, what left the device, what it cost, when.
   Store it in Firestore. It is the product's trust story *and* it makes the hybrid behaviour
   legible to a non-technical judge.

Also: **never silently upload.** If a task falls back to cloud, say so *before* sending, and let
the user decline. That single interaction is the product.

---

## 8. Known risks

| Risk | Mitigation |
|---|---|
| Judge's laptop has no Gemini Nano (4 GB download, 22 GB free disk, >4 GB VRAM or 16 GB RAM) | Graceful cloud degradation + badge + manual override + hosted URL that works without the model. Consider the `prompt-api-polyfill` local (Transformers.js) tier. |
| Packaged Chrome extension (MV3) support is **not documented** by Firebase for the hybrid SDK | The hackathon permits "a web app **or** a Chrome extension", but Firebase's hybrid docs only cover web apps. **Ship a web app.** Treat an extension as a stretch goal. |
| On-device quality is weaker than cloud | Design the on-device tier for *discrete, typed* tasks (classification, extraction) where it is strong. Don't ask it to write. Use the cloud tier for generation. |
| On-device has no multi-turn | Implement a single `ask()` that carries history manually and truncates to 9,216 tokens, used by both paths. |
| On-device input cap (9,216) | Use it as your cloud-escalation rule: length → cloud. |
| Multimodal on-device needs a Chrome flag | Don't make it load-bearing in v1. |
| Debug App Check token in a public repo | The rules accept debug tokens in submissions, but **don't commit the token**. Register it in the console and document the setup steps in the README instead. |
| Free-tier rate limits | Firebase default per-user limit is 100 req/min; stay well under it in the demo. |
| You miss the quota window | Text inference is free — the quota account is only needed for image generation. Don't let it gate the build. |

---

## 9. Submission checklist (all four required)

- [ ] **Public repo** on GitHub or GitLab, with an **OSI license file** (Apache-2.0 preferred)
      visible in the repo's About section. Include setup instructions and the value proposition.
- [ ] **Firebase AI Logic demonstrably used at runtime** — imported *and actually called* in code.
      A library import, an app/backend entry point, or a loaded agent/flow/MCP config. Naming it in
      the README is not enough.
- [ ] **Demo video ≤ 3 minutes**, publicly visible on YouTube, English or English subtitles,
      showing the app actually running on your chosen platform.
- [ ] **Text description**: how you used Firebase AI Logic, a summary of features/functionality,
      and the value proposition.
- [ ] **Hosted project URL** — strongly encouraged.
- [ ] Select your platform category (Web/Chrome / Android / iOS) on the form. Note: the sponsors
      may reassign a submission between categories.

---

## 10. Timeline (10 days, one person can hit this)

| Day | Milestone |
|---|---|
| **Fri Nov 20 (today)** | 🔴 **Free disk space → ≥25 GB**, re-run the probe, confirm `availability: "available"`. Create the Firebase project + AI Logic setup. Get an AI Studio API key. Register the App Check debug token. Register on Devpost. Join Discord. **Scaffold the app** (Vite + React + TS) with `firebase@13` and a working `generateContent` call. |
| **Sat Nov 21** | 🔴 **Highest-risk day.** Build the on-device tier end-to-end: structured output + enum `type` + `inferenceSource` badge + manual override. Nothing else. If Gemini Nano's extraction quality is poor, find out now — it changes the design. |
| **Sun Nov 22** | Cloud tier + the 9,216-token escalation rule. Regex pre-pass. Merge/dedupe. |
| **Mon Nov 23** | The UI: highlights, finding list, accept/reject, masking, copy/download. Remote Config. Offline state. |
| **Tue Nov 24** | Firestore privacy receipt + anonymous Auth. Real product feel: empty states, errors, polish. Deploy to Firebase Hosting. |
| **Wed Nov 25** | README + value proposition + Apache-2.0 license + `LICENSE` file. **Record the video** (script in §13.6). **Quota request deadline 10:00 AM PT** if you want image gen. |
| **Thu Nov 26** | Re-record the video. Test the hosted URL as a logged-out visitor. Fix what's clunky. |
| **Fri Nov 27** | Buffer. Sprint 3 quota account arrives if you requested one. |
| **Sat–Sun Nov 28–29** | Final buffer. Verify: repo public, license visible, Firebase AI Logic **imported and actually called** in code, hosted URL works, video is public on YouTube. |
| **Mon Nov 30, 2:00 PM PT** | **Submit.** Do not wait until the 13th. |

**Solo discipline:** no new features after Wed Nov 25. From that point you are only fixing, recording,
and submitting. If the on-device tier works and the product is coherent, that is enough to win a
platform award.

---

## 11. Immediate actions (today)

1. **Register on Devpost** — <https://firebasehybridaihackathon.devpost.com>. **3,619 people have
   already joined.**
2. **Check country eligibility.** The excluded list includes **Brazil, Italy, Iran, Russia,
   Belarus, Crimea, Cuba, North Korea, Quebec, Sudan, Syria.** If you're in an excluded territory
   you cannot enter.
3. **Join Discord** — <https://discord.gg/Mfbaz3AaC>. Channels: `#buildhybridai-chat` (find
   teammates) and `#hackathon-help` (tag your question with `#BuildHybridAI`).
4. **Create the Firebase project** and walk the AI Logic setup wizard.
5. **Verify on-device availability** on a machine you control (Chrome 139+, the flag, 22 GB free).
   This is the single biggest schedule risk — find out today.
6. **Install the Firebase agent skills** — already done in this session:
   `claude plugin marketplace add firebase/agent-skills` + `claude plugin install firebase@firebase`.
7. **Pick your idea** and start the on-device tier.

---

## 13. Solo + Web-only scope (the real plan)

### 13.1 Architecture

```
┌─ paste / drop text ───────────────────────────────────────────┐
│                                                                │
│  ① DETERMINISTIC PRE-PASS (regex, local, instant)              │
│     AWS AKIA · ghp_/github_pat_ · sk_/pk_ · xox · AIza · JWT   │
│     -----BEGIN PRIVATE KEY----- · Bearer · generic emails      │
│                          │                                     │
│  ② AI PASS  ── 4,000 chars of prompt ──►  hybrid model        │
│     semantic PII only: PERSON, PHONE, ADDRESS, MEDICAL_ID,     │
│     SSN, DOB, FINANCIAL_ACCOUNT, ORG, CREDENTIAL               │
│     returns JSON: [{type, value, reason}]   ← enum-constrained │
│                          │                                     │
│  ③ MERGE + DEDUPE (overlap) → ranked findings                  │
│                          │                                     │
│  ④ UI: highlighted text · finding list · accept/reject · mask  │
│  ⑤ OUTPUT: copy / download redacted text                       │
│  ⑥ RECEIPT → Firestore  (what was found, engine, what left)   │
└────────────────────────────────────────────────────────────────┘
```

### 13.2 The hybrid split, precisely

| Tier | Trigger | Engine | Why |
|---|---|---|---|
| **Local** | default, text ≤ 9,216 tokens, device available | Gemini Nano (Chrome) | The secret must never travel. Instant, offline, free. |
| **Cloud** | text > 9,216 tokens, OR user forces it, OR device unavailable | `gemini-3.8-flash` (free tier) | The on-device model's hard context limit. A *structural* reason, not "the cloud is smarter". |

**Both tiers run the same prompt and the same schema**, so you can show them side by side on the
same input and compare the `inferenceSource` badge. That comparison is the money shot for the
judges.

### 13.3 Must-have vs. cut

**MUST SHIP (the whole product):**
1. Paste box + drag-and-drop for text files.
2. Regex pre-pass (the deterministic safety net).
3. On-device AI pass with structured output + enum-constrained `type`.
4. Merge/dedupe/rank findings.
5. Highlighted-text UI with per-finding accept/reject and masking.
6. Copy + download redacted output.
7. `inferenceSource` badge + manual override (Auto / On-device / Cloud).
8. Offline detection → switch to `PREFER_IN_CLOUD` when offline (falls back *to* local).
9. Visible token meter explaining the 9,216 escalation.
10. Privacy receipt → Firestore.
11. Remote Config flag for routing/strictness.
12. Deployed to Firebase Hosting. Apache-2.0 license. README + value prop. 3-min video.

**CUT (do not build):**
- Chrome extension (Firebase doesn't document packaged MV3 hybrid setup)
- Android / iOS (Android hybrid is still experimental)
- Team workspaces, sharing, auth roles → use anonymous auth only
- PDF parsing → cloud tier handles long *pasted text*; skip file parsing
- "Safe-to-share summary" → only if you have spare hours
- Any pixel-polish beyond a clean, coherent look

### 13.4 If you can't free the disk space

Ranked fallbacks:

1. **Use another machine** that has ≥22 GB free. The model is already downloaded on this one, but
   the *volume* is the constraint, so any modern Mac with 25 GB+ free works. Cheapest fix if you
   have access to one.
2. **External SSD / Time Machine volume** — move Chrome's profile to a volume with space. Fragile
   for a hackathon; avoid.
3. **`prompt-api-polyfill` with a local Transformers.js backend** — same `LanguageModel` API, but
   the local model is a few hundred MB with no 22 GB gate. The cloud backend is *still Firebase AI
   Logic*, so the app remains Firebase AI Logic hybrid. This is a legitimate and interesting
   third tier: **Chrome Gemini Nano → local Transformers.js → Firebase AI Logic cloud**. It also
   makes the app work for judges without Gemini Nano. Treat as a stretch goal once the main path
   works.

Note the 22 GB gate only applies to Chrome's built-in model. A Transformers.js local tier is a
legitimate way to keep the "never leaves the device" promise on a machine that can't host
Gemini Nano.

### 13.5 Engineering decisions that reduce risk

- **Never trust the model's character offsets.** Ask it for `{type, value, reason}` and locate
  `value` in the source text yourself. Offsets from a 4B-class model will be wrong often enough to
  look broken. Value-matching with a fuzzy fallback is robust.
- **Single-turn only.** On-device has no `startChat`. Keep one prompt per scan, keep the prompt
  under ~4,000 chars, and put the text in the user turn. No conversation history.
- **Enum-constrain `type`** with `Schema.enumString` so you never have to parse a free-text label.
- **Regex first, AI second.** The regex layer makes the product trustworthy *and* gives you a
  fallback if the on-device model is weak — which is exactly the honest engineering story the
  rubric rewards.
- **Keep the receipt honest.** If a scan ran locally, the receipt says nothing left the device.
  Make that verifiable.

### 13.6 3-minute video script

| Time | Shot |
|---|---|
| 0:00–0:15 | The problem + one stat: "29M secrets leaked on GitHub in 2025. AI-assisted commits leak at 2× the rate." |
| 0:15–0:45 | Paste a realistic log containing an AWS key, an email, a phone number, a patient name. Hit **Scan**. |
| 0:45–1:05 | **ON DEVICE** badge lights up. Findings highlight. Text never left — show the empty network panel. |
| 1:05–1:30 | Toggle **Force cloud** → same input → **CLOUD** badge → deeper/different findings. Side-by-side comparison. |
| 1:30–1:55 | Paste a long document → the token meter crosses 9,216 → app says "this will be scanned in the cloud" and does so. |
| 1:55–2:30 | Accept/reject findings, mask, copy the redacted output. Open the **privacy receipt**. |
| 2:30–3:00 | Tech stack, repo link, "free, no signup, nothing leaves your machine." |

Record it on the **fixed** machine with the model actually running. A video that shows the real
on-device path is worth more than a nicer product with a fallback.

---

**Firebase / Google**
- [Firebase AI Logic overview](https://firebase.google.com/products/firebase-ai-logic)
- [Hybrid inference overview](https://firebase.google.com/docs/ai-logic/hybrid)
- [Hybrid inference — Web get-started](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started)
- [Hybrid inference — Web configuration options](https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options)
- [Hybrid inference — Web structured output](https://firebase.google.com/docs/ai-logic/hybrid/web/generate-structured-output)
- [Production checklist](https://firebase.google.com/docs/ai-logic/production-checklist)
- [Firebase Agent Skills](https://firebase.google.com/docs/ai-assistance/agent-skills) · [skills repo](https://github.com/firebase/agent-skills) · [llms.txt](https://firebase.google.com/docs/ai-assistance/llms.txt)
- [Hybrid AI prompting with Firebase AI Logic (Chrome)](https://developer.chrome.com/docs/ai/firebase-ai-logic)
- [Understanding hybrid inference (Firebase blog)](https://firebase.blog/posts/2025/10/understand-ai-logic-hybrid-inference/)
- [Gemini API pricing](https://aistudio.google.com/docs/pricing)
- [The Prompt API (Chrome)](https://developer.chrome.com/docs/ai/prompt-api) · [Built-in AI status](https://developer.chrome.com/docs/ai/built-in-apis)
- [prompt-api-polyfill (ChromeLabs)](https://github.com/GoogleChromeLabs/web-ai-demos/tree/main/prompt-api-polyfill)
- [Karrot case study](https://developer.android.com/blog/posts/gemini-and-firebase-ai-logic-enabled-karrot-to-increase-sales-with-a-translation-feature)
- [Jojo Apps / Finnish it TTS case study](https://firebase.blog/posts/2026/09/ai-logic-text-to-speech/)
- [Experimental hybrid inference for Android](https://developer.android.com/blog/posts/experimental-hybrid-inference-and-new-gemini-models-for-android)

**Problem evidence**
- [GitHub — Secret protection must scale with software](https://github.blog/ai-and-ml/github-copilot/secret-protection-must-scale-with-software/)
- [GitGuardian — GitHub Secrets Leaked: Why AI Tools Make It Worse](https://www.elegantsoftwaresolutions.com/blog/github-secrets-leaked-why-ai-tools-make-it-worse)
- [GitGuardian — Yes, GitHub Copilot can leak secrets](https://blog.gitguardian.com/yes-github-copilot-can-leak-secrets/)
- [Apiiro — Coding Agents Are Leaking Your Secrets to GitHub](https://apiiro.com/blog/coding-agents-leaking-secrets-github-dont-ask-again)
- [Wiz — 65% of Forbes AI 50 Leaked Secrets](https://www.wiz.io/blog/forbes-ai-50-leaking-secrets)
- [GitHub Docs — scanning for AI-detected secrets](https://docs.github.com/en/enterprise-cloud@latest/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enabling-secret-scanning-for-ai-detected-secrets)
- [Microsoft Presidio](https://github.com/microsoft/presidio)
