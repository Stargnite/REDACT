# REDACT — Design System

**Inherited from `~/Desktop/portfolio-v27` — "Vermilion on Black".** Same tokens, same typefaces,
same motion vocabulary. This document records what carries over, what adapts, and the one place
where the two products genuinely disagree.

Source of truth: `portfolio-v27/docs/design-direction.md` and `portfolio-v27/app/globals.css`.
Where this document and that one differ, **this one wins** for REDACT — and the difference is
always called out.

---

## 1. Tokens — carried over verbatim

```css
@import "tailwindcss";
@import "tw-animate-css";

@theme inline {
  --color-canvas:   #08090a;
  --color-surface:  #0e0f11;
  --color-text:     #f7f6f3;
  --color-muted:    rgba(247, 246, 243, 0.62);
  --color-faint:    rgba(247, 246, 243, 0.5);
  --color-accent:   #ff4a1c;
  --color-hairline: rgba(247, 246, 243, 0.1);

  --font-display: "Instrument Serif", "Iowan Old Style", Georgia, "Times New Roman", serif;
  --font-sans:    "Geist", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono:    "Geist Mono", ui-monospace, "SF Mono", "Menlo", monospace;

  --text-display: clamp(1.9rem, 9vw, 7rem);
  --text-display--line-height: 0.95;
  --text-display--letter-spacing: -0.035em;

  --text-h1: clamp(2.1rem, 5.2vw, 3.6rem);
  --text-h1--line-height: 1.05;
  --text-h1--letter-spacing: -0.025em;

  --text-h2: clamp(1.6rem, 3.2vw, 2.4rem);
  --text-h2--line-height: 1.15;
  --text-h2--letter-spacing: -0.02em;

  --text-h3: 1.25rem;
  --text-h3--line-height: 1.3;
  --text-h3--letter-spacing: -0.01em;

  --text-body: 1.0625rem;
  --text-body--line-height: 1.75;

  --text-micro: 0.8125rem;
  --text-micro--line-height: 1.5;

  --radius-none: 0px;
  --ease-out-expo: cubic-bezier(0.22, 1, 0.36, 1);
}
```

Plus the layout constants, base layer, utilities (`mono`, `measure`, `measure-tight`, `hairline`,
`grain`) and the `prefers-reduced-motion` block — copied unchanged from `portfolio-v27/app/globals.css`.

**Fonts are copied, not downloaded.** The four woff2 files already exist at
`~/Desktop/portfolio-v27/public/fonts/` (83 KB total). They are copied into
`redact/public/fonts/`. Both families are SIL Open Font License, so this is permitted, and it
means REDACT has zero font network requests and zero layout shift. `scripts/fetch-fonts.sh` is
copied too, as a fallback if the woff2 files are ever lost.

---

## 2. What carries over, what adapts, what is dropped

| portfolio-v27 principle | REDACT | Note |
|---|---|---|
| Four-value palette, one accent | **Carried over** | See §4 for how finding types work with one hue |
| Instrument Serif display / Geist body / Geist Mono micro | **Carried over** | Same four woff2 files |
| Fluid `clamp()` type scale, 68ch measure | **Carried over** | 68ch applies to prose; the editor is `max-width: none` |
| Hairline rules as the only divider | **Carried over** | — |
| Vermilion focus ring, 2px, 2px offset | **Carried over** | — |
| 150 / 240 / 600ms motion, `cubic-bezier(0.22,1,0.36,1)` | **Carried over** | — |
| `prefers-reduced-motion` → instant, no transform | **Carried over** | Same block, same semantics |
| Grain overlay, 2.5% opacity SVG, inlined data URI | **Carried over** | — |
| Dark-only, no light theme | **Carried over** | A tool is dark-only anyway; halves the QA surface |
| `cn()` via clsx + tailwind-merge | **Carried over** | — |
| `Reveal` / `MaskReveal` from `motion/react` | **Carried over** | `motion` v12, `useReducedMotion` |
| Button / Input / Textarea / Label primitives | **Carried over** | Same shadcn-free shapes |
| `SectionLabel` + `Hairline` | **Carried over** | — |
| Copy budget (page ≤ 220 words) | **Adapted** | Binding on `/`, `/how-it-works`, `/privacy`. **Not** on `/scan`, which is a tool |
| "One accent element per section" | **Adapted** | In the scrubber the accent is reserved for the focus state and the ON_DEVICE badge. Rationale in §4 |
| Chapter rail (fixed left column) | **Dropped** | A portfolio device. It would steal horizontal space from the editor |
| Hanging numerals | **Dropped** | Same reason |
| The 5-column rule | **Dropped** | The editor needs full width. Applies to prose blocks only |
| Portrait / vermilion keyline frame | **Dropped** | No portrait in a tool |
| Editorial work rows | **Adapted** | The findings list is an editorial row: mono type label, hairline, vermilion wipe on hover |

---

## 3. Component recipes — REDACT-specific

| Component | Definition |
|---|---|
| `FindingRow` | mono type label, the matched quote in Geist, hairline rule, vermilion wipe on hover, mask toggle on the right |
| `InferenceBadge` | ON_DEVICE → solid vermilion, black text. IN_CLOUD → hairline border, muted text. Mono, uppercase. Never both accented in one panel |
| `EscalationNotice` | mono uppercase line: `ESCALATED — INPUT EXCEEDED THE ON-DEVICE CONTEXT WINDOW`. Muted text, hairline left rule. No accent — the badge above already carries the accent |
| `PrivacyMeter` | mono numerals: `12,431 CHARS IN · 0 BYTES OUT`. Vermilion only on the `0` |
| `ModeToggle` | three states as hairline-bordered mono buttons; the active one is vermilion-bordered, vermilion text |
| `Editor` | full-width `Textarea`, `bg-surface`, hairline border, accent border on focus. Monospace off — Geist, because this is prose people paste into a chatbot, not code |
| `ReceiptPanel` | a `SectionLabel` + a hairline-ruled list of mono key/value pairs |
| `LandingHero` | `MaskReveal` on the display headline — the same 600ms mask reveal the portfolio hero uses. Once, on load |

---

## 4. The one real conflict: finding types need more than one colour

portfolio-v27's constitution is *"One accent colour. Vermilion `#FF4A1C`. If something needs
emphasis, it uses the accent. Nothing else gets a colour."*

A secret scanner has to distinguish at least four kinds of finding: **credentials, personal
data, identifiers, and low-confidence matches**. The obvious move — a hue per type — breaks the
constitution and, worse, breaks WCAG 2.2 AA's "never signal by colour alone".

**Resolution: type is carried by the mono label and the underline treatment; hue is never
carried by type.**

| Severity | Underline | Mono label | Example |
|---|---|---|---|
| Critical — a live credential | solid, 2px | `AWS ACCESS KEY` | `AKIAIOSFODNN7EXAMPLE` |
| High — personal data | dashed, 2px | `PERSON` · `EMAIL` · `PHONE` | `jane.doe@gmail.com` |
| Low — an identifier | dotted, 1px | `EMPLOYER` · `IP ADDRESS` | `203.0.113.42` |

All three use the same vermilion. On hover the span's background lifts to
`rgba(255, 74, 28, 0.10)` — the same "vermilion lift" trick, at a readable strength.

**Why this is the right call, not just the compliant one:**
- It is legible in greyscale and to a colour-blind reader, because the label and the underline
  carry the meaning.
- It keeps the accent rationing intact. The scan panel has exactly one accent moment: the
  **ON_DEVICE badge**. Everything else is hairline and muted.
- It looks like the portfolio. A palette of five pastel chip colours would have looked like a
  dashboard template — exactly what the checklist's item 01 forbids.

The masked output renders as a mono token: `[REDACTED:AWS_ACCESS_KEY]`.

### Where the accent IS allowed in the scrubber

1. The focus ring.
2. The active `ModeToggle` button.
3. The **ON_DEVICE** badge.

Never more than one of those in the same panel at the same time, and never as a large fill.

---

## 5. Motion — carried over

| Token | Value | Use |
|---|---|---|
| fast | 150ms | hover, underline wipes, focus transitions |
| base | 240ms | panel transitions, accordion, row reveal |
| slow | 600ms | the landing hero mask reveal — once, on load |
| ease | `cubic-bezier(0.22, 1, 0.36, 1)` | everything |

The scrubber gets **one** choreography: findings fade and rise 12px, staggered 60ms, as they
land. No per-element animation on top of it. The landing page gets **one**: the hero mask
reveal. Never two on a route.

`prefers-reduced-motion` → instant, no transform, no delay. Same block as portfolio-v27.

---

## 6. Accessibility

- Body text ≥ 4.5:1, large text and UI ≥ 3:1. On `#08090A`, `#F7F6F3` is ~17:1 and
  `--color-muted` is ~8:1 — both pass. `--color-faint` at 0.5 alpha is ~5:1 and is used only
  for mono micro-labels at 13px, which still passes AA.
- Findings are never signalled by colour alone (see §4).
- Errors are never signalled by colour alone — a mono label carries the state.
- Every interactive element ≥ 44px tall on touch.
- No horizontal scroll at 320px.
- The editor's textarea has a real `<label>`; the mode toggle is a `radiogroup`.
- `aria-live="polite"` on the results region so a screen reader announces the scan outcome.

---

## 7. Copy voice

portfolio-v27's `CLAUDE.md` sets the voice: **no résumé voice**, no "passionate developer", no
exclamation marks, and *"write like a person explaining something they built, with a number or a
mechanism behind any claim that could be unfalsifiable."*

That rule transfers to REDACT's landing page and README. In a privacy tool the standard is
even stricter: **every claim must be checkable.** "Nothing left your device" is only true if the
byte counter proves it, and the counter is on screen. No "military-grade encryption" — there is
no encryption, there is local inference.

---

## 8. Fonts — provenance and licence

| File | Source | Licence |
|---|---|---|
| `instrument-serif.woff2` | `portfolio-v27/public/fonts/` | SIL OFL 1.1 |
| `instrument-serif-italic.woff2` | same | SIL OFL 1.1 |
| `geist.woff2` | same | SIL OFL 1.1 |
| `geist-mono.woff2` | same | SIL OFL 1.1 |

Copied, not re-downloaded. `scripts/fetch-fonts.sh` is copied as a fallback. The `public/fonts/og`
TrueType variants exist only for `next/og` rendering — REDACT will generate an OG image, so
those are copied too.
