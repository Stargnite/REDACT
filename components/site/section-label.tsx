export function SectionLabel({
  index,
  children,
  className = "",
}: {
  index: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`mono flex items-center gap-3 font-normal text-faint ${className}`}>
      <span className="text-accent">{index}</span>
      <span aria-hidden className="h-px w-6 bg-hairline" />
      <span>{children}</span>
    </h2>
  );
}

export function Hairline({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`h-px w-full bg-hairline ${className}`} />;
}
