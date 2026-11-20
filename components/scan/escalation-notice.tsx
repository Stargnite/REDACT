/**
 * Shown when the text was too large for the on-device window and went to the
 * cloud instead. Muted text, a hairline left rule, no accent. The badge
 * above already carries the accent, and two accent moments in one panel
 * would break the rationing.
 */
export function EscalationNotice({ reason }: { reason: string }) {
  return (
    <p className="border-l border-hairline pl-4 text-muted">
      <span className="mono block text-faint">ESCALATED</span>
      <span className="mt-1 block text-sm">{reason}</span>
    </p>
  );
}
