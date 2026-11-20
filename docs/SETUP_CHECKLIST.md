# REDACT — Setup Checklist (everything outside this repo)

**Everything in this file is something only you can do, or that needs a browser session I cannot
open for you.** Nothing here involves writing application code — the code lives in
`REDACT_BUILD_PLAN.md` and `REDACT_DESIGN_SYSTEM.md`.

Deadline: **Mon 30 Nov 2026, 2:00 PM PT.** Today is Fri 20 Nov 2026. That is 10 days, and the
items below are ordered by what blocks the most downstream work.

**Interval 1 (20 Nov 2026) is committed and pushed.** The app builds, the pattern tier
runs in the browser, and 23 unit tests cover the scan pipeline. Everything below is
what the Firebase project needs before the model tier can run.

---

## A. Blocking the build (do these first, today)

### A1. `firebase login` — one browser OAuth click
The CLI is installed (`firebase-tools@15.37.0`) but not authenticated. Everything in §B waits on
this.

```bash
firebase login
```

Open the URL it prints, sign in with the Google account you want the project under, approve.
Verify with:

```bash
firebase login:list
```

**Why you:** it is a browser OAuth grant on your Google account. I cannot complete it for you.

### A2. Create the Firebase project (I can run this the moment you are logged in)
Spark plan, no card. I run:

```bash
firebase projects:create redact-local --display-name "REDACT"
```

**Why you:** only if you want a different project ID than `redact-local` — project IDs are
permanent and globally unique, so tell me now if you would rather choose it yourself.

### A3. AI Services → AI Logic → Get started → **Gemini Developer API**
Console only. This is the free-tier path. The *Agent Platform / Vertex AI* option is the paid one
and would force Blaze — do not pick it.

The setup flow auto-enables **App Check for AI Logic**. Afterwards, confirm under
**Security → App Check → APIs** that AI Logic reads **Enforced**.

**Why you:** the API enablement is tied to your Google account's AI Studio consent flow.

### A4. App Check → reCAPTCHA v3 — register a keypair
Console only. One field to copy:
- **Site key** → goes in `.env.local` as `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`

The **secret key is not needed.** It only signs tokens server-side, and REDACT has no server. Keep
the secret key out of the repo regardless.

Register **two** domains: `localhost` and `your-project-id.web.app`.

> **Do NOT add `localhost` to the reCAPTCHA *allowed domains* list.** The Firebase docs are
> explicit that the App Check allowed-domains list and the reCAPTCHA allowed-domains list are
> different things, and adding localhost to the latter breaks local dev.

**Why you:** the secret key is only ever shown once, on your screen, and I cannot read it.

### A5. App Check debug token (I create it, you paste it)
I run:

```bash
firebase appcheck:debugtokens:create --app <your-appId>
```

It prints a token. You paste it into `.env.local` as
`NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN`. **Never committed to git.**

Paste the literal token string, not the word `true` — a literal token does not expire, `true` does.

**Why you:** the paste is one line into a file that is gitignored, and I will write the file for
you if you would rather just tell me the value.

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
confusing error.

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
- The live demo URL (`https://<project-id>.web.app`)
- The video link
- Screenshot(s)

### B7. The deployment domain
Firebase Hosting gives `https://<project-id>.web.app` free on Spark. If you want a clean domain
(`redact.app` or similar) that needs a registrar and possibly a Cloud Run/Hosting rewrite — **skip
it.** The `.web.app` URL is free and is what judges expect.

---

## C. Things you already have (verified on this machine, 20 Nov 2026)

| Thing | Status |
|---|---|
| Node | v24.14.0 |
| npm | 11.9.0 |
| git | 2.37.1 (Apple Git-137.1) |
| firebase-tools | 15.37.0, installed globally |
| Chrome | present, on-device Gemini Nano **available** and answering |
| Free disk | ~29 GB — above the ~22 GB gate the on-device model needs |
| `gh` | **not installed** |
| `ffmpeg` | **not installed** |
| Supabase | not in use, and not planned — see below |

---

## D. What I need from you, and when

| When | What | Why |
|---|---|---|
| Today | Run `firebase login` | Blocks every Firebase step |
| Today | Confirm the project ID (`redact-local` or one you pick) | Permanent, globally unique |
| Today | Paste the reCAPTCHA site + secret key, and the debug token | Only shown on your screen |
| Today | Enable the Anonymous auth provider | Console-only |
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

The one piece of persistence we keep — the receipt that records *how many* findings a scan produced,
not *what* was in it — is Firestore, metadata only, and it is optional: if it breaks, the receipt
falls back to `localStorage` and the scrubber still works.
