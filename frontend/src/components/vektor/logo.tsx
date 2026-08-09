import { cn } from "@/lib/utils";

export function VektorMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden="true">
      <path
        d="M4 5 L16 27 L28 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M10 5 L16 16 L22 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.45"
      />
    </svg>
  );
}

export function VektorWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <VektorMark className="h-6 w-6 text-primary" />
      <span className="font-display text-[1.35rem] font-bold leading-none tracking-[-0.04em] text-foreground">
        Vektor
      </span>
    </span>
  );
}
