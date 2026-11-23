"use client";

import { PURPOSES } from "@/lib/purpose";
import type { OutputForm, Purpose } from "@/lib/types";

const FORM_OPTIONS: { value: OutputForm; label: string; hint: string }[] = [
  {
    value: "rewritten",
    label: "REWRITTEN",
    hint: "Each secret becomes a generic phrase, so the sentence still reads.",
  },
  {
    value: "token",
    label: "TOKENS",
    hint: "Each secret becomes a label, like [REDACTED:EMAIL].",
  },
];

const ACTIVE_CLASS =
  "mono border border-accent px-3 py-2 text-accent transition-colors duration-150";
const IDLE_CLASS =
  "mono border border-hairline px-3 py-2 text-muted transition-colors duration-150 hover:border-accent hover:text-accent";

/**
 * Purpose is the one control that changes what counts as sensitive, so it
 * sits above the text. The chosen purpose is stated in plain words beneath
 * the control, because a seven-way choice that only shows labels is a guess.
 */
export function PurposePicker({
  purpose,
  onChange,
  note,
  onNoteChange,
}: {
  purpose: Purpose;
  onChange: (next: Purpose) => void;
  note: string;
  onNoteChange: (next: string) => void;
}) {
  const active = PURPOSES.find((item) => item.value === purpose) ?? PURPOSES[0];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="mono text-faint">WHERE IS THIS GOING?</span>
        <span className="mono text-faint">PURPOSE</span>
      </div>

      <div
        role="radiogroup"
        aria-label="What the text is for"
        className="mt-3 flex flex-wrap gap-2"
      >
        {PURPOSES.map((option) => {
          const isActive = option.value === purpose;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(option.value)}
              className={isActive ? ACTIVE_CLASS : IDLE_CLASS}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-muted">
        {active.hint}
      </p>

      {purpose === "custom" ? (
        <div className="mt-4">
          <label htmlFor="purpose-note" className="mono block text-faint">
            YOUR RULE
          </label>
          <textarea
            id="purpose-note"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={3}
            placeholder="Keep the project name, hide the client name."
            className="mt-2 w-full border border-hairline bg-surface p-3 text-sm text-text"
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * How the clean copy should read. A rewritten copy is something you can send
 * without editing; a tokenised copy is something you can audit.
 */
export function OutputFormToggle({
  value,
  onChange,
}: {
  value: OutputForm;
  onChange: (next: OutputForm) => void;
}) {
  const active =
    FORM_OPTIONS.find((option) => option.value === value) ?? FORM_OPTIONS[0];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="mono text-faint">HOW SHOULD IT READ?</span>
        <span className="mono text-faint">OUTPUT</span>
      </div>

      <div
        role="radiogroup"
        aria-label="How the clean copy should read"
        className="mt-3 flex flex-wrap gap-2"
      >
        {FORM_OPTIONS.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(option.value)}
              className={isActive ? ACTIVE_CLASS : IDLE_CLASS}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-muted">
        {active.hint}
      </p>
    </div>
  );
}