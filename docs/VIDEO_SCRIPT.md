# REDACT — 3-minute demo video script

**Runtime:** 2:45. **Two minutes forty-five seconds**, with about fifteen seconds of slack for
the pauses nobody plans for.

This replaces the script in `HACKATHON_BRIEF.md` §13.6, which was written for the old UI — a
`Scan` button, a `Force cloud` toggle, accept/reject buttons and a privacy receipt panel. None
of that exists any more. Everything below is a shot of the app as it is actually shipped.

---

## Before you press record

**The one thing that will ruin the take: a cold model.**

The first on-device inference on a cold Gemini Nano takes **~98 seconds**. A warm one takes
**1–7 seconds**. If you record cold, the 0:34 shot eats a minute and a half of a three-minute
video and everything after it is rushed.

> **Warm the model first.** Two minutes before recording, open the site in Chrome and run one
> throwaway on-device scan — or run `node scripts/probe-warm-latency.mjs`. Confirm the reply strip
> reads `ON DEVICE`. Only then start recording.

**The rest:**

| # | Do this | Why |
|---|---|---|
| 1 | Record on **this Mac, in Chrome**, with Gemini Nano present | A recording made anywhere else silently falls back to the cloud and the central claim collapses |
| 2 | **1920×1080**, Chrome zoom **100%** | The type is small on a laptop and judges watch on a phone |
| 3 | Check the **cloud quota** first | The tier-comparison shot spends one request. If the quota is gone, that shot becomes an error notice — **do not record that** |
| 4 | Put the **corpus** in a text file and the **screenshot** on the Desktop, ready to paste and drop | You should not be typing during a take |
| 5 | Open a **text editor** and leave it empty, in a tab | For the 1:50 copy beat |
| 6 | Clear the **clipboard**, close every tab showing a real secret, check no **tab title** leaks anything | Checklist G5 |
| 7 | Do **one full dry run**, timed, before the real take | |

**DevTools:** closed for 0:00–1:05. The network shot at 1:05 is a hard cut to a separate capture —
DevTools docked right, Network tab, filtered on `generativelanguage`, **completely empty**. Capture
that as its own 5-second clip beforehand and drop it in the edit. Trying to open DevTools on camera
wastes eight seconds of a three-minute video.

---

## The corpus

Paste this. It is deliberately built so **both** tiers have something to do: the top half is a form
that the deterministic rules read by its labels, the bottom half is prose that only a model can
read.

```
FULL NAME: Amara Okonkwo
EMAIL: amara.okonkwo@northwind-labs.io
PHONE: +44 7700 900418
HOME ADDRESS: Flat 12, 88 Cavendish Road, London N12 6QT
EMPLOYER: Northwind Labs
API KEY: sk_live_TESTONLYKEY0000000000000000

Hi, I'm Priya Raman. I work at Northwind Logistics and I live at 42 Larkspur Road, Leeds. My supervisor is Marcus Webb and the project is called Aurora.
```

The findings list will show the form values tagged `PATTERN` and the prose names tagged `MODEL`,
in one frame. That is the two-tier architecture, visible, in a single shot.

**Do not say a number of spans out loud.** Gemini Nano's recall is non-deterministic — the same
input has given eleven spans once and eight the next time. Say "every span" and let the number sit
on screen where it belongs. The **0 CHARS SENT** number, on the other hand, is exact — say that one.

---

## The shot list

### 0:00–0:14 — The problem
**Screen:** `redact-fdd1a.web.app`. The landing page: **"Paste safe."** and the paragraph under it.
Scroll down slowly to the three steps — *Paste it in / We read it locally / You get the clean copy*.

> **VO:** "In 2025, twenty-nine million secrets were exposed on GitHub. AI-assisted commits
> leaked at twice the rate of hand-written ones. Every one of those leaks started the same way —
> a paste."

### 0:14–0:24 — What it is
**Screen:** Click **"Open the scrubber"** → `/scan`. The empty state. Hold on the sticky composer:
the settings row reading `SETTINGS · GENERAL · TOKENS · AUTOMATIC` with **CHANGE** on the right, the
text area, `ENTER TO SCRUB`, and the vermilion **SCRUB** button.

> **VO:** "REDACT is a paste box. You tell it where the text is going, and it hands back a clean
> copy with every secret taken out."

### 0:24–0:34 — The controls
**Screen:** Click **CHANGE**. The panel opens: *Where is this going?* (seven purposes),
*How should it read?* (**REWRITTEN** / **TOKENS**), and the mode toggle **AUTO / ON DEVICE /
CLOUD**. Click **ON DEVICE** — the hint underneath changes to *"Never send the text to a server."*
Click **CHANGE** again to close the panel.

> **VO:** "You choose the destination, and you choose the tier. On device means the text never
> reaches a server. Not 'we try not to'. Never."

### 0:34–0:50 — The scan
**Screen:** Paste the corpus (⌘V) and press **Enter**.

What happens, in order: the composer **empties itself**; your text stays on screen in the `YOUR
TEXT` turn above the reply; the `REDACT` turn appears with the progress list — **KNOWN FORMATS**
ticks over to a solid dot, then **THE MODEL ON THIS DEVICE** lights up with a sliding bar and a
clock counting up. Leave the wait in. Four seconds of visible waiting is honest and it buys trust.

> **VO:** "Rules run first. They catch anything with a fixed shape — keys, tokens, card numbers,
> emails — and a form that says FULL NAME over a name has told us what it is. Then Gemini Nano runs
> inside Chrome and reads what rules cannot: names, employers, addresses."

### 0:50–1:05 — The result
**Screen:** The reply strip, top of the `REDACT` turn:
**`ON DEVICE`** (solid vermilion) · **`0 CHARS SENT`** · **`N COVERED`** · **`4.2 S`**.
Then **YOUR TEXT, REDACTED**, the tokenised copy, with **Copy** on the right.

> **VO:** "Zero characters sent. And that badge isn't our guess — it's the runtime the Firebase SDK
> reports actually served the request."

### 1:05–1:18 — The proof
**Screen:** **Hard cut.** The app on the left; DevTools docked right, **Network** tab, filtered on
`generativelanguage`. The panel is **completely empty**.

> **VO:** "Network panel. Nothing. The secret was found on the same machine it was pasted on."

### 1:18–1:32 — What was found
**Screen:** Scroll to **WHAT WAS FOUND · N SPANS**. Each row: the type on the left, **`PATTERN`** or
**`MODEL`** on the right, the token underneath. Click **Show the match** on one — it reveals the
actual value, underlined.

> **VO:** "Every span, and where it came from — the rule tier or the model. You can reveal any one
> of them to check it. The model is never the judge of its own redaction."

### 1:32–1:50 — The hybrid
**Screen:** Scroll to **AND THE OTHER TIER?** Click **ASK THE CLOUD TOO**. The progress runs again.
Then either **THE CLOUD ADDED 2** (with the extra spans listed) or **THE CLOUD FOUND NOTHING THE
DEVICE MISSED**. Below it: **`N CHARS SENT TO GOOGLE · 3.2 S`**.

> **VO:** "One click sends the same text to the cloud model and shows you exactly what the device
> missed — and exactly what that cost. It's never automatic. It's your call, every time."

*If it says "FOUND NOTHING THE DEVICE MISSED", that is a fine shot. Say:* "…and this time the
device was enough. It found nothing the cloud didn't. The device is usually enough."

### 1:50–2:02 — The copy
**Screen:** Click **Copy** next to `YOUR TEXT, REDACTED`. Cut to the text editor, ⌘V. The clean
copy is there, readable, with no secrets in it.

> **VO:** "And the copy is clean. Paste it."

### 2:02–2:26 — The picture
**Screen:** `/image`. Drop the screenshot on the drop zone. Click **Scrub the picture**. The
progress runs: **READING THE PICTURE** (with a real progress bar) → **KNOWN FORMATS** → **THE
MODEL ON THIS DEVICE** → **COVERING THE WORDS**. Then **SCRUBBED PICTURE** — the original with black
bars over the email and the key — and **Download the scrubbed picture**. Scroll to the receipt on
the right: `TIER · ON DEVICE`, `TEXT SENT · NOTHING`.

> **VO:** "Screenshots too. A screenshot is read by an OCR engine running in a worker in your
> browser — not a vision model — so the picture itself is never uploaded, in any tier. The same
> tiers scan the words, and bars are drawn over them."

### 2:26–2:45 — The close
**Screen:** `/privacy`, scrolling through the five facts. Then a final frame: the repo URL and
`redact-fdd1a.web.app` on screen.

> **VO:** "Firebase AI Logic. Gemini Nano on the device, Gemini in the cloud, and a static site with
> no backend, no database and no account. Nothing about you is stored, because there is nowhere for
> it to live. Link below."

---

## The shots that must exist

1. `Paste safe.` + the stat (0:00)
2. The paste, and the composer emptying (0:34)
3. The progress bar with the clock counting (0:42)
4. **`ON DEVICE` + `0 CHARS SENT`** (0:50)
5. **The empty network panel** (1:05) — *the single most important frame in the video*
6. The findings list showing `PATTERN` and `MODEL` side by side (1:18)
7. **THE CLOUD ADDED N** (1:32)
8. The clean copy in a plain text editor (1:50)
9. The barred picture (2:14)
10. The repo link (2:40)

---

## If you are running long

Cut in this order, and only this order:

1. The controls beat at 0:24 — save 10 seconds. The tier is visible in the badge anyway.
2. The findings beat at 1:18 — save 14 seconds. But then **do not** say "where it came from" in
   the VO; it will not have been shown.
3. The picture beat at 2:02 — save 24 seconds. This is the biggest loss. The picture path is a
   differentiator; keep it if you can.

**Never cut** the empty network panel (1:05). It is the proof, and it is the reason the video
exists.

---

## Do not record these

| Do not show | Why |
|---|---|
| `QUOTA EXCEEDED` or any cloud error | A scan that hits the quota still returns findings — the pattern tier never fails — so the page looks clean while the model tier contributed nothing. The number of findings on screen is not the number of secrets in the text |
| `PATTERNS ONLY` | That is the badge from a browser with no on-device model. It contradicts every claim in the video |
| `N SPANS NOT COVERED` | It is honest, and it is the wrong shot for a three-minute demo. The checklist corpus is tuned to avoid it. If it appears, re-run the scan |
| Any real secret | Everything in the corpus is fake |
| A cold-model wait | Ninety-eight seconds of a waiting bar is not a demo |

---

## Post-production

- [ ] Cut the leading and trailing silence — 2 seconds of each is plenty
- [ ] Title card or lower-third for **REDACT** and `redact-fdd1a.web.app` at 0:02, and the repo
      URL at 2:40
- [ ] The stat (**29 million secrets / 2× the rate**) as on-screen text at 0:05, so it survives
      muted playback. Judges watch with the sound off
- [ ] Verify **0 CHARS SENT** is legible in the 0:50 frame at the final export resolution
- [ ] Upload to YouTube as **unlisted**, not private
- [ ] Link it on Devpost
