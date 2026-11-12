import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, LogOut, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { InlineError, LoadingScreen, PageHeader } from "@/components/lexi/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { sessionSize, weeklyMinutes } from "@/lib/plan";
import { profileQuery } from "@/lib/queries";
import { CEFR_LEVELS, NATIVE_LANGUAGES, STUDY_GOALS } from "@/lib/study-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_hub/settings")({
  head: () => ({
    meta: [
      { title: "Profilo di studio — LexiFlow" },
      { name: "description", content: "Modifica livello, obiettivo e frequenza di studio." },
      { property: "og:title", content: "Profilo di studio — LexiFlow" },
      { property: "og:description", content: "Le impostazioni del tuo piano di studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  pendingComponent: () => <LoadingScreen />,
  errorComponent: ({ error, reset }) => <InlineError message={error instanceof Error ? error.message : undefined} onRetry={reset} />,
  component: SettingsPage,
});

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200",
        active ? "border-primary bg-primary text-primary-foreground shadow-soft" : "border-border bg-paper hover:border-foreground/25",
      )}
    >
      {children}
    </button>
  );
}

function SettingsPage() {
  const { data: profile } = useSuspenseQuery(profileQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(profile.display_name ?? "");
  const [lang, setLang] = useState(profile.native_language ?? "it");
  const [level, setLevel] = useState(profile.cefr_level ?? "B1");
  const [goal, setGoal] = useState(profile.goal ?? "conversation");
  const [days, setDays] = useState(profile.days_per_week ?? 4);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim().slice(0, 60) || null, native_language: lang, cefr_level: level, goal, days_per_week: days })
      .eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error("Salvataggio non riuscito");
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profilo aggiornato");
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Impostazioni"
        title={<>Profilo di <span className="italic text-primary">studio</span></>}
        description="Le nuove lezioni verranno calibrate su queste scelte."
      />

      <section className="paper space-y-7 p-6 sm:p-8">
        <div className="grid gap-1.5">
          <label htmlFor="name" className="eyebrow">Nome</label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 max-w-sm rounded-xl bg-background" maxLength={60} />
        </div>
        <div>
          <p className="eyebrow mb-3">Lingua nativa</p>
          <div className="flex flex-wrap gap-2">
            {NATIVE_LANGUAGES.map((l) => (
              <Chip key={l.id} active={lang === l.id} onClick={() => setLang(l.id)}>
                <span aria-hidden="true">{l.flag}</span> {l.name}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow mb-3">Livello CEFR</p>
          <div className="flex flex-wrap gap-2">
            {CEFR_LEVELS.map((l) => (
              <Chip key={l.id} active={level === l.id} onClick={() => setLevel(l.id)}>
                <span className="font-display italic">{l.id}</span> {l.name}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow mb-3">Obiettivo</p>
          <div className="flex flex-wrap gap-2">
            {STUDY_GOALS.map((g) => (
              <Chip key={g.id} active={goal === g.id} onClick={() => setGoal(g.id)}>{g.name}</Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow mb-3">Giorni a settimana</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <Chip key={d} active={days === d} onClick={() => setDays(d)}>{d}</Chip>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sessioni da {sessionSize(level, days)} schede · circa {weeklyMinutes(level, days)} minuti a settimana.
          </p>
        </div>
        <div className="ledger-rule flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={signOut}>
            <LogOut /> Esci dall'account
          </Button>
          <Button size="lg" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Salva modifiche
          </Button>
        </div>
      </section>
    </div>
  );
}
