import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft",
        className,
      )}
    >
      <span className="absolute inset-[3px] rounded-full border border-primary-foreground/35" />
      <span className="font-display text-[15px] font-semibold italic leading-none tracking-tight">Lf</span>
    </span>
  );
}

export function Logo({ to = "/", className }: { to?: "/" | "/dashboard"; className?: string }) {
  return (
    <Link to={to} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="LexiFlow Study Hub">
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[19px] font-semibold tracking-tight text-foreground">LexiFlow</span>
        <span className="eyebrow mt-0.5 text-[9.5px]">Study Hub · Est. 2026</span>
      </span>
    </Link>
  );
}
