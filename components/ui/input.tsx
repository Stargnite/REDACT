import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
}) {
  return (
    <input
      className={cn(
        "w-full border border-hairline bg-transparent px-4 py-3 text-text",
        "placeholder:text-faint focus:border-accent focus:outline-none",
        className
      )}
      {...props}
    />
  );
}
