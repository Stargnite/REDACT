# REDACT — pre-demo test checklist

**Work through this in order. Every box has a pass criterion you can see on screen.**

The demo's whole claim is *"the secret never left the device"*. That claim is only true if the
on-device tier actually ran, on the machine that recorded the video. So the order matters: prove
the device tier first (B), then exercise the features (C), then the failure modes (E), and only
then touch the cloud tier (F) — because the cloud tier is 20 requests a day for the whole project
and every one you spend is one you cannot spend on the day of recording.

Deadline: **Mon 30 Nov 2026, 2:00 PM PT.** Today is Sat 21 Nov 2026.

---

## A. Environment gates (2 minutes, do these first)

| # | Check | Command / place | Pass |
|---|---|---|---|
| A1 | Free disk | `df -h /` | **≥ 22 GB free.** Below this Chrome silently refuses to start Gemini Nano and every scan falls back to the cloud, which breaks the demo and spends your quota. |
| A2 | The model is on disk | `ls ~/Library/Application\ Support/Google/Chrome/OptGuideOnDeviceModel/` | a version folder is listed (4 GB) |
| A3 | Chrome | `chrome://version` | Chrome 158+ on macOS |
| A4 | Nothing else is running | — | Quit Slack/Discord/X, turn on Do Not Disturb, close every tab that shows a real secret, empty the clipboard |

---

## B. The on-device proof — your Chrome only (10 minutes, **blocking**)

This must be done in **your own Chrome**, not a test profile. My browser has no Gemini Nano in it
and every "on-device unavailable" I report is a false negative.

| # | Step | Pass criterion |
|---|---|---|
| B1 | Open `https://redact-fdd1a.web.app/scan/` | the page loads |
| B2 | DevTools ⌥⌘I → Console → paste `await LanguageModel.availability()` (if Chrome refuses, type `allow pasting` first) | returns **`"available"`**. `"downloadable"`/`"downloading"` → wait. `"unavailable"` → disk or flag, see A1 and B5. |
| B3 | Paste **Corpus B** below into the composer, set mode to **ON DEVICE**, press Enter | the reply arrives and the badge reads **ON DEVICE**, and the receipt reads **0 CHARS SENT** |
| B4 | Open DevTools → Network → filter `generativelanguage` / `firebase` | **no request leaves the browser.** This is the single most important shot in the video: the empty network panel is the proof. |
| B5 | If the API is missing: `chrome://flags/#prompt-api-for-gemini-nano` → Enabled → restart Chrome | — |

> **Do this before anything else.** If B3 fails, the demo cannot be recorded as planned and you need
> to know now, not on the morning of the deadline.

---

## C. Feature script, in the order the video will show it

Work on the **deployed URL**, not localhost, so what you test is what judges get. But open a
**normal window, not a private one** — you want the site to behave like a first-time visitor.

### C1. Text scrub — the chat shape

- [ ] Paste **Corpus A** (the form), press Enter. Progress appears: `THE RULES` → `THE ON-DEVICE MODEL`, with the bar sliding and an elapsed clock. ✅ *the bar moves and the clock counts up*
- [ ] The reply shows the **black-barred document**: your text with real black bars over every covered span. ✅ *bars are black, the text under them is not selectable*
- [ ] The clean copy below shows `[REDACTED:EMAIL]` style tokens. ✅ *tokens name the type*
- [ ] `COPY` puts the clean copy on the clipboard. ✅ *paste it into a text editor to confirm*
- [ ] The findings list shows each finding with its type and source (PATTERN / MODEL). ✅ *list is not empty*
- [ ] The receipt strip reads `ON DEVICE · 0 CHARS SENT · N COVERED · N.N S`. ✅ *0 chars sent*

### C2. The tier comparison (this is the differentiator — rehearse it)

- [ ] Under **"AND THE OTHER TIER?"** press **"ASK THE CLOUD TOO"**. ✅ *a second run starts*
- [ ] It reports either **"THE CLOUD ADDED N"** (and lists the spans the device missed) or **"THE CLOUD FOUND NOTHING THE DEVICE MISSED"**. Both are fine on camera — but **"THE CLOUD ADDED N" tells a better story**, so run it on a corpus where you know the device will miss something (Corpus B, prose). See F1 for the quota cost.
- [ ] The line under it states how many characters went to Google and how long it took. ✅ *honest accounting*

### C3. Escalation — long input goes to the cloud

- [ ] Paste **Corpus D** (a long document, > 9,216 tokens ≈ 37,000 characters). ✅
- [ ] The app says the text is larger than the on-device model can hold and sends it to the cloud. ✅ *badge reads IN CLOUD and the receipt shows a non-zero CHARS SENT*
- [ ] Cost: **1 cloud request.** Do this once, not repeatedly.

### C4. Picture scrub — `/image`

- [ ] Upload a **screenshot containing real secrets** (Corpus A as a screenshot, or a terminal window with the AWS key).
- [ ] Progress shows four stages: `READING THE PICTURE` → `THE RULES` → `THE CLOUD MODEL` → `COVERING THE WORDS`. ✅ *the OCR stage reports a real progress fraction*
- [ ] The result lists regions with type and pixel coordinates. ✅
- [ ] **SCRUBBED PICTURE** shows the original with black bars drawn over the words, and **DOWNLOAD THE SCRUBBED PICTURE** works. ✅ *open the download and check the bars are in the right place*
- [ ] "WHAT WAS READ OUT OF IT" shows the transcript. ✅
- [ ] The receipt reads `TEXT SENT: NOTHING` on an ON DEVICE run. ✅

### C5. Leak test — `/leak-test`

- [ ] Paste **Corpus A**, run it. ✅ *a verdict, not just a list*
- [ ] The verdict is a plain-English judgement about what the model tier found. ✅

### C6. The rest of the site

- [ ] `/` landing — headline, the stat, the honest framing. ✅
- [ ] `/how-it-works` — the hybrid explanation. ✅
- [ ] `/privacy` — says what leaves and what does not. ✅
- [ ] The nav: on a phone, MENU opens, every route is reachable. ✅
- [ ] Every page loads with **no console errors**. ✅ (DevTools → Console, reload each page)

### C7. Mobile — check at 375 px, not just on your laptop

- [ ] Scan page: composer pinned to the bottom of the screen, context collapsed to one line (`GENERAL · REWRITTEN · AUTO / CHANGE`). ✅
- [ ] The black-barred document scrolls rather than overflowing the screen. ✅
- [ ] `/image` at 375 px: the picture preview fits, the buttons stack. ✅
- [ ] `/leak-test` at 375 px. ✅

---

## D. Accuracy corpus — the thing that broke before

**Run each of these at least twice.** Gemini Nano's recall is non-deterministic: the same input read
twice has given 6 spans once and 3 the next time. If a scan misses something, run it again before
you record — and if it *still* misses it, that is a deterministic-tier bug, not a model bug.

**Corpus A — the form (deterministic field-label tier; must be 6/6 every time):**

```
FULL NAME: Amara Okonkwo
EMAIL: amara.okonkwo@northwind-labs.io
PHONE: +44 7700 900418
HOME ADDRESS: Flat 12, 88 Cavendish Road, London N12 6QT
EMPLOYER: Northwind Labs
API KEY: sk_live_TESTONLYKEY0000000000000000
```

| Field | Must be covered | Must **not** be covered |
|---|---|---|
| Amara Okonkwo | ✅ | |
| amara.okonkwo@northwind-labs.io | ✅ | |
| +44 7700 900418 | ✅ | |
| Flat 12, 88 Cavendish Road, London N12 6QT | ✅ | |
| Northwind Labs | ✅ | |
| sk_live_TESTONLYKEY0000000000000000 | ✅ | |
| the labels (`FULL NAME`, `EMAIL`, …) | | ✅ **never covered** |

**Corpus B — prose (model tier; regex cannot catch these):**

```
Hi, I'm Priya Raman. I work at Northwind Logistics and I live at 42 Larkspur Road, Leeds. My supervisor is Marcus Webb and the project is called Aurora.
```

Must be covered: `Priya Raman`, `Northwind Logistics`, `42 Larkspur Road`, `Leeds`, `Marcus Webb`.
Must be **retained**: `Aurora` — a project name is not a secret.

**Corpus C — a log line (both tiers):**

```
2026-11-20T09:14:22Z INFO auth service=payments key=AKIAIOSFODNN7EXAMPLE user=amara.okonkwo@northwindlabs.com ip=10.4.19.22 msg="retry attempt 3"
```

Must be covered: the AWS key, the email. `10.4.19.22` and `retry attempt 3` are fine either way.

**Corpus D — long input, for escalation only:** any document over ~37,000 characters.

**Corpus E — a picture:** a screenshot of Corpus A, and one screenshot of a terminal showing Corpus C.

---

## E. Failure modes — these must degrade, not break

The demo is judged partly on honesty. A judge may ask "what if the model is missing?" The answer
has to be on screen and calm.

| # | How to force it | Pass criterion |
|---|---|---|
| E1 | Scan in a **Safari** tab (no Gemini Nano) | badge says the tier that actually ran; no crash; the notice explains that only the fixed-shape rules ran |
| E2 | Scan in Chrome **with the model disabled** (`chrome://on-device-internals`) | same |
| E3 | Turn off wifi for one scan | on-device still works, or fails with a plain message |
| E4 | After the cloud quota is spent | the receipt says the model tier failed / quota exceeded, and the page says the result is a **partial scrub** — it does not present a clean-looking result as complete |
| E5 | Reload the page mid-scan | no white screen |

---

## F. Cloud quota — spend it deliberately

The free tier is **20 requests a day for the whole project**. Not per user, not per browser.

| # | Step | Cost |
|---|---|---|
| F1 | One smoke test with a trivial prompt (not the scrubber), to prove App Check + the genai config are good | 1 |
| F2 | The tier comparison in C2, once, on Corpus B | 1 |
| F3 | The escalation in C3, once | 1 |
| F4 | The leak test on the cloud tier | 1 |

**Leave the rest.** If you burn 15 requests testing on Saturday, you cannot record a cloud-tier shot
on Monday. **Record the demo on the on-device tier**, and treat the cloud as a footnote.

> A scan that hits the quota still returns findings — the pattern tier never fails — so the page can
> look clean while the model tier contributed nothing. If you see `QUOTA EXCEEDED` on camera, the
> number of findings on screen is **not** the number of secrets in the text. Do not record that shot.

---

## G. Recording readiness

| # | Item | Command / place |
|---|---|---|
| G1 | `ffmpeg` installed | `brew install ffmpeg` |
| G2 | A screen-capture method that works | `screencapture -x -V 60 out.mov` (macOS built-in, 60 s) or Chrome's own tab recorder |
| G3 | Screen resolution decided | record at 1920×1080, or capture the window rather than the full screen |
| G4 | Chrome zoom | **100 %** — the type is small on a laptop and judges watch on a phone |
| G5 | The composer is empty, the clipboard is empty, and no real secret is in any tab title | — |
| G6 | One full dry run, timed | the 3-minute script in `HACKATHON_BRIEF.md` §13.6 is written for the **old** UI (a `Scan` button, a `Force cloud` toggle, accept/reject, a privacy receipt). The shipped UI is the chat-shaped scrub with `ENTER TO SCRUB`, a collapsed context line, a **black-barred document**, and **"ASK THE CLOUD TOO"**. **Rewrite the script to the shipped UI** before you record — a shot list that does not match the screen makes you stumble on camera. |
| G7 | The shots that must exist | ① the problem + stat (0:00) ② paste and scrub with the progress bar visible (0:15) ③ the black-barred document + **empty network panel** (0:45) ④ "ASK THE CLOUD TOO" and the delta (1:05) ⑤ the picture scrub with the bars drawn (1:30) ⑥ the clean copy and the copy button (1:55) ⑦ stack, repo link, "nothing left your machine" (2:30) |

**Record on this Mac, in Chrome, with the model present.** A recording made on another laptop will
silently fall back to the cloud and the central claim collapses on camera.

---

## H. Repository and submission

| # | Item | Status |
|---|---|---|
| H1 | Repo public | `Stargnite/REDACT` — ✅ public |
| H2 | **A `README.md`** | ❌ **missing** — the submission checklist wants setup instructions and the value proposition. Write it. |
| H3 | **A `LICENSE` file** (Apache-2.0) | ❌ **missing** — the submission checklist wants an OSI license visible in the repo's About section. Add it. |
| H4 | `main` is 7 commits behind `feature/context-aware-redaction` | ❌ **not merged** — the deployed site is built from the feature branch. Merge to `main` (or point judges at the branch) before you submit. |
| H5 | The video is **unlisted**, not private, on YouTube | ❌ |
| H6 | Devpost: project name, description, built-with list, repo URL, live URL, video link, screenshot | ❌ |

---

## I. Console steps that are still open (you, in the Firebase console)

| # | Step | Where | Why it is still open |
|---|---|---|---|
| I1 | **AI Logic setup wizard** | Console → AI Services → AI Logic → Get started → **Gemini Developer API** → replay protection **Disabled** | The genai config is written by this console workflow only — there is no public API for it. Our cloud calls have only ever returned `429 quota exceeded`, and the quota wall is checked *before* the config, so the wizard is still unconfirmed. **Do it and then run F1** — that single smoke test settles whether the cloud tier works at all. |
| I2 | **Anonymous auth** → Enable | Console → Authentication → Sign-in method → Anonymous | Console-only; there is no CLI command. |
| I3 | Remote Config — publish an empty template once | Console → Project settings → General → Remote Config | Only if it shows as not initialised. |
| I4 | Firestore | — | **Not needed.** There is no backend; the receipt is generated in the page. Skip it. |

---

## J. Order of operations

1. **A** (gates) → **B** (on-device proof) → **D** (accuracy corpus, twice each)
2. **C1, C4, C5, C6, C7** (features that cost nothing — no quota)
3. **I1** console → **F1** smoke test → then **F2/F3/F4** if the quota allows
4. **E** (failure modes) — do these *after* the good path, so a broken failure mode does not eat your day
5. **G** (recording) → **H** (repo) → submit
