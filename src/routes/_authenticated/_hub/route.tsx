import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Flame, Home, Layers, Library, LogOut, Plus, Settings2, Sparkles } from "lucide-react";

import { Logo } from "@/components/lexi/logo";
import { InlineError, LoadingScreen } from "@/components/lexi/ui-bits";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { displayedStreak, toLocalDateString } from "@/lib/streak";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_hub")({
  beforeLoad: async ({ context }) => {
    const profile = await context.queryClient.ensureQueryData(profileQuery);
    if (!profile.onboarded) throw redirect({ to: "/onboarding" });
  },
  pendingComponent: () => <LoadingScreen />,
  errorComponent: ({ error, reset }) => (
    <div className="px-5 py-20">
      <InlineError message={error instanceof Error ? error.message : undefined} onRetry={reset} />
    </div>
  ),
  component: HubLayout,
});

const NAV = [
  { to: "/dashboard", label: "Oggi", icon: Home },
  { to: "/review", label: "Ripasso", icon: Layers },
  { to: "/upload", label: "Carica", icon: Plus },
  { to: "/library", label: "Archivio", icon: Library },
  { to: "/settings", label: "Profilo", icon: Settings2 },
] as const;

function HubLayout() {
  const { data: profile } = useQuery(profileQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const streak = profile
    ? displayedStreak(
        { streak: profile.streak, lastStudyDate: profile.last_study_date, daysPerWeek: profile.days_per_week ?? 7 },
        toLocalDateString(),
      )
    : 0;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (profile?.display_name ?? "LF").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen">
      <div className="stripe-preppy h-1 w-full" />
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Logo to="/dashboard" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Principale">
            {NAV.filter((n) => n.to !== "/settings").map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "!bg-secondary !text-foreground" }}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-paper px-3 text-sm font-semibold"
              title="Streak di studio"
            >
              <Flame className={cn("size-4", streak > 0 ? "text-burgundy" : "text-muted-foreground")} />
              {streak}
            </span>
            <span
              className="hidden h-9 items-center gap-1.5 rounded-full border border-border bg-paper px-3 text-sm font-semibold sm:inline-flex"
              title="XP totali"
            >
              <Sparkles className="size-4 text-gold" />
              {profile?.xp ?? 0}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex size-9 items-center justify-center rounded-full bg-navy font-mono text-xs font-medium text-navy-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Menu account"
              >
                {initials}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl">
                <DropdownMenuLabel className="font-normal">
                  <span className="block truncate text-sm font-semibold">{profile?.display_name ?? "Studente"}</span>
                  <span className="eyebrow text-[10px]">
                    {profile?.cefr_level} · {profile?.xp ?? 0} XP
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: "/settings" })}>
                  <Settings2 /> Profilo di studio
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={signOut}>
                  <LogOut /> Esci
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-32 pt-8 sm:px-8 md:pb-16 md:pt-10">
        <Outlet />
      </main>

      <nav
        aria-label="Navigazione mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
          {NAV.map(({ to, label, icon: Icon }) =>
            to === "/upload" ? (
              <Link key={to} to={to} className="flex flex-col items-center" aria-label={label}>
                <span className="-mt-6 flex size-14 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lift transition-transform active:scale-95">
                  <Icon className="size-6" />
                </span>
              </Link>
            ) : (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center gap-1 py-1 text-muted-foreground transition-colors"
                activeProps={{ className: "!text-primary" }}
              >
                <Icon className="size-5" />
                <span className="text-[10.5px] font-semibold">{label}</span>
              </Link>
            ),
          )}
        </div>
      </nav>
    </div>
  );
}
