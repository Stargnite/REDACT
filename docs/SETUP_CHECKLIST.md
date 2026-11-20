# REDACT — Setup Checklist (everything outside this repo)

**Everything in this file is something only you can do, or that needs a browser session I cannot
open for you.** Nothing here involves writing application code — the code lives in
`REDACT_BUILD_PLAN.md` and `REDACT_DESIGN_SYSTEM.md`.

Deadline: **Mon 30 Nov 2026, 2:00 PM PT.** Today is Fri 20 Nov 2026. That is 10 days, and the
items below are ordered by what blocks the most downstream work.

**Interval 1 (20 Nov 2026) is committed and pushed.** The app builds, the pattern tier runs in the
browser, and 26 unit tests cover the scan pipeline and the rule set. Everything below is what the
Firebase project still needs before the model tier can run for anyone but you.

---

## A. Blocking the build (do these first, today)

### A1. `firebase login` — **done**

**Done, 20 Nov 2026.** Signed in as `tobyolamide22@gmail.com`, confirmed with
`firebase login:list`. Every step below needs it, and every step below has used it.

### A2. The Firebase project — **done**

**Done.** Project id `redact-fdd1a`, project number `95167246245`, display name *Redact*, web app
id `1:95167246245:web:27667255f7f8ae5c55424c`. Spark plan, no card.

### A3. AI Services → AI Logic → Get started → **Gemini Developer API**

Console only. This is the free-tier path. The *Agent Platform / Vertex AI* option is the paid one
and would force Blaze — do not pick it.

**Status, 20 Nov 2026:** I have already enabled `firebasevertexai.googleapis.com` and
`firebaseappcheck.googleapis.com` on the project from the CLI. A direct call used to return
`Firebase AI Logic genai config not found`; it now returns `429 quota exceeded`, because the
free tier has been spent by the probe runs. The quota wall is checked before the config, so the
console step below is still unconfirmed and still the one thing left to do.

The setup flow auto-enables **App Check for AI Logic**. Afterwards, confirm under
**Security → App Check → APIs** that AI Logic reads **Enforced**. If it reads **Unenforced**,
enforce it before going on.

The wizard's last step asks about **replay protection**. Answer **Disabled**. Enforced mode
requires the client to request limited-use App Check tokens, which our web SDK does not do, so
enforcing it would block every cloud request. Disabled has no performance or cost impact, which
is what a demo needs.

**Why you:** the genai config is written by the console workflow only — there is no public API for
it (I probed the AI Logic and Firebase Management discovery docs; the resource does not exist
outside the console).

### A3b. The cloud model and the free tier quota

The cloud tier runs `gemini-3.8-flash` (`NEXT_PUBLIC_FIREBASE_CLOUD_MODEL` in `.env.local`).
`gemini-2.5-flash` is closed to new projects and answers with a 404 that tells you to move to
`gemini-3.8-flash`. The Firebase guide's own example uses `gemini-4-hydrogen`; that name does not
404 either, so keep it as the fallback if `gemini-3.8-flash` stays congested. I have not switched
to it, because I cannot get a 200 out of either one today.

The free tier is rate limited and the limit is small: the 429 names the metric
`generativelanguage.googleapis.com/generate_content_free_tier_requests` with **20 requests**. Once
that is spent, cloud calls answer `429 quota exceeded` until the daily reset. Two consequences:

- **Record the demo on the on-device tier.** It is the product's claim and it does not spend a
  quota.
- **Do not spend the quota on test paragraphs.** Every cloud scan counts against the same 20, so a
  long testing session is exactly what leaves you unable to demo the cloud tier.

**A scan that hits the quota still returns findings, and that is the dangerous part.** The pattern
tier runs first and never fails, so a quota error means the model tier contributed nothing while the
page still shows a clean-looking result. The badge reads `PATTERNS ONLY` and the receipt shows
`MODEL TIER · 0`, but a name, an employer, an address or a free-form secret would never have been
caught. The scan panel now says this in words — `QUOTA EXCEEDED`, the findings come from the pattern
rules alone, treat this as a partial scrub — and the raw SDK dump is behind a `Technical detail`
disclosure instead of being dumped into the layout. If you see that notice in a demo, the number of
findings on screen is not the number of secrets in the text.

**First cloud smoke test, once the quota resets.** Do it with a trivial prompt before testing the
scrubber, so a failure means the plumbing is broken rather than our code. The Firebase guide uses
*Write a story about a magic backpack.* If that comes back with text, App Check and the genai
config are both good and anything wrong afterwards is ours.

### A4. App Check → reCAPTCHA — **done and verified**

**Status, 20 Nov 2026: done and verified end to end.** The key is registered, App Check is
enforced, and the deployed site passes App Check. The proof:

- A model request with **no** App Check token is rejected with `401 Firebase App Check token is
  invalid` — so enforcement is genuinely on for AI Logic.
- A **cold** visit to `https://redact-fdd1a.web.app/scan/` — empty browser cache, no debug token —
  sends `POST .../exchangeRecaptchaEnterpriseToken` and gets **200**. The model request then
  carries an `x-firebase-appcheck` JWT whose payload says `"provider":"recaptcha_enterprise"`, so
  the reCAPTCHA Enterprise provider really did run in a real browser and was accepted. The request
  reaches the model endpoint and gets a quota error, not an App Check error.

What you did, for the record:

**Part 1 — create the key (Google Cloud console, not Firebase):**

1. Open **https://console.cloud.google.com/fraud-defense/keys?project=redact-fdd1a**
2. **Create key** → key type **Website** → **Score based (v3)**. This is the only kind the Fraud
   Defense console issues now; there is no classic key left to create.
3. **Authorized domains**: `redact-fdd1a.web.app`. This is the only domain list that matters, and it
   lives on the reCAPTCHA key in Google Cloud, not in Firebase. To change it later: Fraud Defense →
   Keys → the key → **Edit** → **Domain list**.
4. Accept the terms and create. You get a **site key** and a **secret key**.

> **Do NOT add `localhost` to the authorized domains list.** The AI Logic setup guide warns that
> listing localhost lets anyone run the app locally against your quota. Local development does not
> need it: with the debug token the reCAPTCHA provider is never called at all.

**Part 2 — register the app with Firebase:**

1. Firebase console → **Security → App Check → Apps tab → Register app** (not the Build button).
2. Choose the **web app** — the one already registered as *Redact*.
3. Provider: **reCAPTCHA Enterprise**.
4. Paste the **site key**. The Enterprise provider takes the site key, not the secret key.
5. Save, then turn **Enforcement** on.

> **The secret key is not needed and is never committed.** The classic *reCAPTCHA v3* provider
> wants a secret key, but Google no longer issues classic keys — the Fraud Defense console only
> creates score-based Enterprise keys, and Firebase has a provider for those that takes the site
> key instead. If you want to see the secret key anyway, it is behind **Integration → "Use legacy
> key"**. Nothing in this project uses it.

**Part 3 — give the site key to the app.** The **site key** is in `.env.local` as
`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, and the app uses `ReCaptchaEnterpriseProvider` to match the key
type. `NEXT_PUBLIC_` values are inlined at build time, so rebuild before deploying.

**Spark project, score threshold.** A Spark project only offers the score levels 0.1, 0.3, 0.7
and 0.9, so pick **0.3** in the App Check settings. A higher threshold rejects legitimate browsers
and would break the demo for a judge on a first visit.

**If the App Check page has no Register app button, do A3 first.** The AI Logic setup workflow is
what enables the APIs *and* turns on App Check for AI Logic, and until it has been run once there
is nothing for App Check to register against.

**Not blocking for local work.** With the App Check debug token in `.env.local`, the SDK exchanges
that token and never calls the reCAPTCHA provider, so the site key can stay empty until you are
ready to deploy.

**Why you:** the keypair is only ever shown on your screen, and I cannot read it.

### A4b. The site is live

**Deployed, 20 Nov 2026.** `https://redact-fdd1a.web.app` serves the static export. All four
routes return 200: `/`, `/scan/`, `/how-it-works/`, `/privacy/`.

To redeploy after a change:

```bash
npm run build
firebase deploy --only hosting --project redact-fdd1a
```

The hosting config is `firebase.json` in the repo. `NEXT_PUBLIC_` values are baked in at build
time, so the reCAPTCHA site key has to be in `.env.local` **before** the build, not after.

### A4c. There is no production environment in the console

Firebase Hosting serves static files. It has no runtime environment and no env-var settings page,
so there is nothing to look at and nothing to set — the `NEXT_PUBLIC_*` values are inlined into
the JavaScript bundle at build time instead.

- `.env.local` is the single source of truth for a build. Fill it in, then build.
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` must be in `.env.local` **before** `npm run build`. Adding it
  afterwards changes nothing until you rebuild.
- The Firebase web config and the reCAPTCHA **site** key are in the shipped bundle by design. They
  are not secrets — a browser app cannot hold a secret. What protects the free tier is App Check
  and the quota, not hiding those values.

`.env.example` lists every variable with an empty value.

### A5. App Check debug token — **done**

**Done, 20 Nov 2026.** Created with `firebase appcheck:debugtokens:create --app <webAppId>` and
living in `.env.local` as `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN`. I verified it on 20 Nov: the debug
token exchange returns 200, so the token is registered and App Check is passing.

The console equivalent, if you ever need to rotate it: **Security → App Check → Apps tab → your
app → overflow menu → Manage debug tokens**.

Paste the literal token string, not the word `true` — a literal token does not expire, `true` does.
**Never committed to git, and never shipped.** `lib/firebase.ts` reads it only when `NODE_ENV` is
not `production`, and `npm run build` compiles that branch away. I checked the built output and
every chunk the deployment serves: none of them contains the token. This matters more than it
looks — anyone holding the debug token can mint App Check tokens for this app and spend the
project's 20-a-day quota, so a token in the shipped bundle would quietly undo the whole App Check
setup.

### A6. Auth → Sign-in method → **Anonymous** → enable

Console only. There is no `firebase auth:enable-provider` command; the CLI only does
`auth:export` / `auth:import`.

**Why you:** provider enablement is console-only.

### A7. Create the Firestore database (I can run this)

I run:

```bash
firebase firestore:databases:create --location=us-central "(default)"
```

Pick the region nearest you if you are not in the US — `firebase firestore:locations` lists them.
Note: **this command can take a few minutes** on a brand-new Spark project, because Firestore
enables the API and provisions the database. That is normal, not a hang.

### A8. Remote Config — publish an empty template once

If **Project settings → General** shows Remote Config as not initialised, open it and publish an
empty template. Fetching an empty template is harmless, but publishing one avoids a first-run
confusing error. The Firebase guide also suggests Remote Config for moving model settings without
republishing the app; that is a nice-to-have, not a blocker.

### A9. Confirm Gemini Nano is live in **your** Chrome — **done, 20 Nov 2026**

`await LanguageModel.availability()` returned **`"available"`** in your Chrome. The on-device tier
is real on this machine, and the hybrid claim can be demonstrated rather than asserted.

This is the demo's central claim, and it can only be checked in your own browser. My browser is a
throwaway profile (`~/.cache/chrome-devtools-mcp/chrome-profile`) with no on-device model in it, so
every "on-device unavailable" I report is a false negative. Do not trust it either way.

**What this does and does not prove.** It proves Chrome's Prompt API is live with the model
present, which is the same capability Firebase AI Logic's `ONLY_ON_DEVICE` mode is built on — the
SDK reads `globalObj.LanguageModel` under the hood. It does not yet prove our own call path works
end to end: our model is created with `expectedInputs`, `expectedOutputs` and an `initialPrompts`
system turn, and the app then has to parse the model's JSON. The app-level check below closes
that gap.

**Step 1 — the app itself (30 seconds).** Open `https://redact-fdd1a.web.app/scan/` in your
Chrome. Paste a paragraph that a regex cannot catch, for example:

```
Hi, I'm Priya Raman. I work at Northwind Logistics and I live at 42 Larkspur Road, Leeds.
My supervisor is Marcus Webb and the project is called Aurora.
```

Choose **ON DEVICE**, press **Scan**. If the result finds the name, the employer and the address,
Gemini Nano ran on this machine. If it errors instead, go to step 2.

**Step 2 — the definitive probe.** In the same tab open DevTools (⌥⌘I), go to **Console**, and run:

```js
await LanguageModel.availability()
```

Chrome refuses pasted code in the console: if it prints *"Warning: Don't paste code into DevTools
Console"*, type `allow pasting`, press Enter, and paste again.

| Result | Meaning |
|---|---|
| `"available"` | The model is downloaded and ready. This machine is good. |
| `"downloadable"` | Chrome can get it but has not yet. Run `await LanguageModel.create()` and wait — 4 GB, minutes to tens of minutes. |
| `"downloading"` | In progress. Wait. |
| `"unavailable"` | Blocked. Nearly always disk space, or the flag below. |
| `LanguageModel is not defined` | The Prompt API is off in this Chrome. Go to step 3. |

To see the actual reason when it is `"unavailable"`:

```js
try { await LanguageModel.create() } catch (e) { console.log(e.name, e.message) }
```

`NotSupportedError` mentioning disk space means the gate in step 4.

**Step 3 — the flag.** Open `chrome://flags/#prompt-api-for-gemini-nano` and set it to **Enabled**,
then restart Chrome. Do the same for `chrome://flags/#optimization-guide-on-device-model` if it
exists. If the flag does not exist in your build, the API ships on by default and step 2's
`LanguageModel is not defined` means something else — usually an enterprise policy.

**Step 4 — the disk gate.** Chrome refuses to initialise the on-device model unless there is about
**22 GB free** on the volume that holds your Chrome profile. That was the blocker this morning: the
disk was at 2.7 GB free and no amount of flag-fiddling would have helped. It is now 31 GB free, so
this should pass. Check with `df -h /`. The model itself is already downloaded, at
`~/Library/Application Support/Google/Chrome/OptGuideOnDeviceModel/2025.8.8.1141/` (4.0 GB).

**Step 5 — Chrome's own view.** `chrome://on-device-internals` shows the installed model version
and whether it is up to date. `chrome://components` lists the "Optimization Guide On Device Model"
component. `chrome://about` has an AI status panel: green is ready, yellow is downloadable, red is
an error.

**What other people's browsers look like.** Gemini Nano is a *device* property, not a site
property, and that is the honest version of the story to tell in the demo:

- It is **Chrome only**. Safari, Firefox and iOS have no Gemini Nano, so for those visitors the
  on-device tier cannot exist at all and the cloud tier is the only option.
- Even in Chrome the model must be present on that machine: ~4 GB downloaded, ~22 GB free disk, a
  supported OS, enough RAM. Many 2026 Chrome installs already have the model on disk.
- An enterprise policy (`GenAILocalFoundationalModelSettings`) can switch it off entirely.

So the app must never *claim* on-device when it did not run on-device, and it must fall back
without breaking. It already does: the badge reads the tier that actually ran, the receipt records
it, and a forced ON DEVICE scan that fails says so instead of quietly using the cloud. That
truthfulness is the demo, not a limitation of it.

---

## B. Outside the repo, but not blocking (do during the build)

### B1. GitHub account + a repository for the project

**Done, 20 Nov 2026.** The repo is `git@github.com:Stargnite/REDACT.git`, branch `main`, and the
first commit is pushed. SSH authenticates as **Stargnite**.

`gh` (the GitHub CLI) is still **not installed** on this machine. It is not needed to push — SSH
does that. It is only needed if you want to open and manage pull requests from the terminal.
Install it with:

```bash
brew install gh
```

then

```bash
gh auth login
```

### B2. A git identity

**Done.** `Oluwatobi <tobi.sobayo@wazobia.tech>` is set globally on this machine.

### B3. The repo name and the public/private choice

**Done.** The repo is `Stargnite/REDACT`, public, `main` as the default branch.

### B4. The demo video — recording and editing

Devpost submissions almost always want a 2–3 minute video, and the hackathon rules require a
working demo link.

**`ffmpeg` is not installed.** You need it for screen capture and for trimming. Install with:

```bash
brew install ffmpeg
```

Two capture options, no extra software:
- `screencapture -x -V 30 out.mov` — macOS built-in, records the screen for 30 seconds
- Chrome's own screen-record tab, or QuickTime's screen recording

The video script and shot list live with the plan — I will write it during the build, once the UI
actually exists, because the shots depend on real screens.

**A hard requirement you cannot skip:** the on-device model needs the *user's* Chrome with the
Gemini Nano model downloaded. So the demo must be recorded on **this Mac**, in Chrome, with the
model present. A recording made on another laptop will silently fall back to the cloud tier, and
the whole "nothing left your device" claim collapses on camera.

### B5. YouTube upload

Upload the video unlisted, put the link in the Devpost submission. Unlisted, not private —
private links fail for the judges who open the submission.

### B6. Devpost submission details

The submission page needs:
- Project name + tagline
- Description (the marketing copy from the landing page, adapted — Devpost wants prose, the
  landing page wants restraint)
- Built-with list: `Next.js`, `Firebase`, `AI Logic`, `Gemini Nano / Prompt API`, `Tailwind CSS`
- The repo URL
- The live demo URL (`https://redact-fdd1a.web.app`)
- The video link
- Screenshot(s)

### B7. The deployment domain

Firebase Hosting gives `https://redact-fdd1a.web.app` free on Spark. If you want a clean domain
(`redact.app` or similar) that needs a registrar and possibly a Cloud Run/Hosting rewrite —
**skip it.** The `.web.app` URL is free and is what judges expect.

---

## C. Things you already have (verified on this machine, 20 Nov 2026)

| Thing | Status |
|---|---|
| Node | v24.14.0 |
| npm | 11.9.0 |
| git | 2.37.1 (Apple Git-137.1) |
| firebase-tools | 15.37.0, installed globally |
| Firebase CLI auth | signed in as `tobyolamide22@gmail.com` |
| Chrome | present, 158.0.8127.36 — on-device Gemini Nano **confirmed available** (`LanguageModel.availability()` → `"available"`, 20 Nov 2026) |
| Free disk | 31 GB — above the ~22 GB gate the on-device model needs (was 2.7 GB this morning) |
| `gh` | **not installed** |
| `ffmpeg` | **not installed** |
| Supabase | not in use, and not planned — see below |

---

## D. What I need from you, and when

| When | What | Why |
|---|---|---|
| Today | Run the AI Logic setup workflow (A3) | Enables the APIs and App Check for AI Logic |
| Today | Enable the Anonymous auth provider | Console-only |
| Today | Run one **ON DEVICE** scan in **your** Chrome on the deployed site | Gemini Nano is present; this proves our call path end to end |
| This week | `brew install gh` + `gh auth login` | Optional - only to manage PRs from the CLI |
| This week | `brew install ffmpeg` | Demo video |
| Before submission | Record + upload the video, fill in Devpost | Submission requirement |

---

## E. A note on the backend question

**No backend is needed, and none is planned.** Everything runs in the browser: the scrubber is a
static export (`next build` → `out/` → Firebase Hosting), and the Firebase calls go straight from
the page to Firestore/Auth/Remote Config using the public web config.

**Supabase is not needed either.** It would work technically, but it duplicates what the Spark
plan already gives free, adds a second vendor and a second set of keys to a Firebase submission,
and reintroduces exactly the server-and-secret risk that the no-backend design exists to remove.
The full reasoning is in `REDACT_BUILD_PLAN.md` §6.

The one piece of persistence we keep — the receipt that records *how many* findings a scan
produced, not *what* was in it — is Firestore, metadata only, and it is optional: if it breaks,
the receipt falls back to `localStorage` and the scrubber still works.
