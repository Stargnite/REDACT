import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-y border border-hairline bg-transparent px-4 py-3 text-text",
        "placeholder:text-faint focus:border-accent focus:outline-none",
        className
      )}
      {...props}
    />
  );
}
