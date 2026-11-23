/**
 * The name of a turn.
 *
 * A hairline square rather than an avatar: an avatar says "a person and a
 * robot are talking", and this is not a person and a robot. It is a scrub.
 */
export function TurnLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mono flex items-center gap-3 text-faint">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 border border-hairline" />
      {children}
    </span>
  );
}
