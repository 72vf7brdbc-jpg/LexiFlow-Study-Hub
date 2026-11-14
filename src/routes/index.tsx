import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookMarked, Camera, Flame, Mic, Sparkles, Repeat2, CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/lexi/logo";
import { Stamp } from "@/components/lexi/ui-bits";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LexiFlow Study Hub — Le tue lezioni d'inglese, in schede intelligenti" },
      {
        name: "description",
        content:
          "Fotografa dispense e appunti: l'AI estrae il vocabolario e crea schede calibrate sul tuo livello (A1–B2) e sull'esame (IELTS, Cambridge, TOEFL).",
      },
      { property: "og:title", content: "LexiFlow Study Hub" },
      {
        property: "og:description",
        content: "Schede di studio con AI, ripetizione spaziata, risposte vocali e streak giornaliera per l'inglese.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);
  return signedIn;
}

const FEATURES = [
  {
    icon: Camera,
    title: "Foto, file o testo",
    body: "Scatta una foto alla dispensa o alla lavagna, carica un PDF o incolla i tuoi appunti.",
  },
  {
    icon: Sparkles,
    title: "Analisi AI su misura",
    body: "Il vocabolario chiave diventa schede calibrate sul tuo livello CEFR e sul tuo esame.",
  },
  {
    icon: Repeat2,
    title: "Ripetizione spaziata",
    body: "Ciò che sbagli torna presto, ciò che sai torna più tardi. Ogni risposta conta.",
  },
  {
    icon: Mic,
    title: "Rispondi a voce",
    body: "Scrivi o pronuncia la risposta: allena anche la pronuncia e l'espressione orale.",
  },
  {
    icon: CalendarDays,
    title: "Archivio per mese",
    body: "Lezioni e schede ordinate cronologicamente: Novembre 2026, Dicembre 2026…",
  },
  {
    icon: Flame,
    title: "Streak & XP",
    body: "Una streak che rispetta il tuo ritmo settimanale e XP per ogni sessione.",
  },
];

function Landing() {
  const signedIn = useSignedIn();
  const cta = signedIn ? (
    <Button asChild size="lg">
      <Link to="/dashboard">
        Vai al tuo studio <ArrowRight />
      </Link>
    </Button>
  ) : (
    <Button asChild size="lg">
      <Link to="/auth">
        Inizia gratis <ArrowRight />
      </Link>
    </Button>
  );

  return (
    <div className="min-h-screen">
      <div className="stripe-preppy h-1.5 w-full opacity-90" />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth">Accedi</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth">Crea account</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-12">
          <div className="animate-rise">
            <Stamp tone="green">A1 · A2 · B1 · B2</Stamp>
            <h1 className="mt-5 text-[2.6rem] font-medium leading-[1.02] sm:text-[3.6rem] lg:text-[4.1rem]">
              Le tue lezioni d'inglese,
              <span className="block italic text-primary">in schede che ricordi.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
              Fotografa dispense, appunti o la lavagna. LexiFlow estrae il vocabolario chiave e crea schede di studio
              calibrate sul tuo livello e sull'esame che prepari — Cambridge, IELTS, TOEFL o inglese per il lavoro.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {cta}
              <span className="eyebrow">Nessuna carta richiesta</span>
            </div>
            <dl className="ledger-rule mt-10 grid max-w-md grid-cols-3 gap-4 pt-5">
              {[
                ["3 step", "Profilo guidato"],
                ["8–20", "Schede per lezione"],
                ["2 modi", "Scrivi o parla"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-display text-2xl font-medium">{k}</dt>
                  <dd className="mt-0.5 text-xs text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative animate-rise [animation-delay:120ms]">
            <div className="paper relative overflow-hidden p-7 shadow-lift sm:p-9">
              <div className="pointer-events-none absolute -right-14 -top-14 size-44 rounded-full border border-border" />
              <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full border border-border" />
              <p className="eyebrow">Sessione di ripasso</p>
              <p className="mt-4 font-display text-4xl italic leading-tight sm:text-5xl">inevitable</p>
              <p className="mt-1 text-sm text-muted-foreground">/ɪnˈevɪtəbl/ · inevitabile</p>
              <p className="mt-5 border-l-2 border-primary/40 pl-4 text-[15px] italic leading-relaxed text-muted-foreground">
                “Change is inevitable, growth is optional.”
              </p>
              <div className="mt-7 grid grid-cols-2 gap-2.5">
                <span className="rounded-xl border border-border bg-background px-3 py-2.5 text-center text-sm font-semibold">inevitabile</span>
                <span className="rounded-xl border border-border bg-background px-3 py-2.5 text-center text-sm text-muted-foreground">evitabile</span>
                <span className="rounded-xl border border-border bg-background px-3 py-2.5 text-center text-sm text-muted-foreground">improbabile</span>
                <span className="rounded-xl border border-border bg-background px-3 py-2.5 text-center text-sm text-muted-foreground">necessario</span>
              </div>
              <div className="mt-7 flex items-center justify-between">
                <span className="eyebrow">Scheda 4 di 15</span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <Sparkles className="size-4" /> +10 XP
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-1/4 rounded-full bg-primary" />
              </div>
            </div>
            <div className="paper absolute -bottom-6 -left-3 w-[230px] rotate-[-2deg] p-4 shadow-lift sm:-left-8">
              <p className="eyebrow">Scheda · B2 · IELTS</p>
              <p className="mt-2 font-display text-2xl italic">reluctant</p>
              <p className="text-xs text-muted-foreground">/rɪˈlʌktənt/ · riluttante</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-3/4 rounded-full bg-primary" />
              </div>
            </div>
            <div className="paper absolute -right-2 -top-4 flex items-center gap-2 px-3.5 py-2 shadow-lift sm:-right-5">
              <Flame className="size-4 text-burgundy" />
              <span className="text-sm font-semibold">12 giorni</span>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-paper/60">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <div className="mb-10 flex items-end justify-between gap-6">
              <div>
                <p className="eyebrow mb-2">Il metodo</p>
                <h2 className="text-3xl font-medium sm:text-4xl">Studia meno a caso, ricorda di più.</h2>
              </div>
              <BookMarked className="hidden size-10 text-camel sm:block" />
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="group bg-paper p-6 transition-colors hover:bg-background">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-full border border-border bg-background text-primary transition-transform duration-300 group-hover:-translate-y-0.5">
                    <Icon className="size-[18px]" />
                  </div>
                  <h3 className="text-lg font-medium">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8">
          <p className="eyebrow mb-3">Pronto quando lo sei tu</p>
          <h2 className="mx-auto max-w-2xl text-3xl font-medium sm:text-[2.6rem] sm:leading-tight">
            Carica la tua prossima lezione e lascia che il ripasso si organizzi da solo.
          </h2>
          <div className="mt-8 flex justify-center">{cta}</div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:px-8">
          <span className="font-display italic">LexiFlow Study Hub</span>
          <span className="eyebrow">Fatto con cura per chi studia l'inglese</span>
        </div>
      </footer>
    </div>
  );
}
