import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline";
};

export function Button({
  className,
  variant = "solid",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 px-6 py-3 text-sm transition-colors duration-150",
        variant === "solid"
          ? "bg-accent text-canvas hover:bg-[#ff6237]"
          : "border border-hairline text-text hover:border-accent hover:text-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
