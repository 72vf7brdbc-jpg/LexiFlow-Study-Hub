import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="animate-rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-[2rem] font-medium leading-[1.05] text-foreground sm:text-[2.6rem]">{title}</h1>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Stamp({ children, tone = "camel", className }: { children: ReactNode; tone?: "camel" | "green" | "navy" | "burgundy"; className?: string }) {
  const tones = {
    camel: "border-camel/60 text-accent-foreground bg-accent/60",
    green: "border-primary/40 text-primary bg-success-soft",
    navy: "border-navy/30 text-navy bg-secondary",
    burgundy: "border-burgundy/35 text-burgundy bg-danger-soft",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressRing({
  value,
  size = 96,
  stroke = 7,
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-secondary)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="paper lined flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-border bg-background text-camel">{icon}</div>
      <h3 className="text-xl font-medium">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LoadingScreen({ label = "Caricamento…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      <p className="eyebrow">{label}</p>
    </div>
  );
}

export function InlineError({ title = "Qualcosa non ha funzionato", message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="paper mx-auto max-w-md px-6 py-10 text-center">
      <p className="eyebrow mb-2 text-burgundy">Avviso</p>
      <h3 className="text-xl font-medium">{title}</h3>
      {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center rounded-full border border-input bg-paper px-5 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          Riprova
        </button>
      )}
    </div>
  );
}
