import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowUpRight, Library, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { SourceIcon, sourceLabel } from "@/components/lexi/source-icon";
import { BooksShelf } from "@/components/lexi/books-shelf";
import { booksQuery } from "@/lib/book-queries";
import { EmptyState, InlineError, LoadingScreen, PageHeader } from "@/components/lexi/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { materialsQuery, type MaterialListItem } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_hub/library/")({
  head: () => ({
    meta: [
      { title: "Archivio lezioni — LexiFlow" },
      { name: "description", content: "Tutte le tue lezioni e schede, ordinate per mese." },
      { property: "og:title", content: "Archivio lezioni — LexiFlow" },
      { property: "og:description", content: "Lezioni, materiali e schede in ordine cronologico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(materialsQuery), context.queryClient.ensureQueryData(booksQuery)]),
  pendingComponent: () => <LoadingScreen />,
  errorComponent: ({ error, reset }) => <InlineError message={error instanceof Error ? error.message : undefined} onRetry={reset} />,
  component: LibraryPage,
});

const FILTERS = [
  { id: "all", label: "Tutti" },
  { id: "photo", label: "Foto" },
  { id: "file", label: "File" },
  { id: "text", label: "Testo" },
] as const;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function LibraryPage() {
  const { data: materials } = useSuspenseQuery(materialsQuery);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = materials.filter(
      (m) =>
        (filter === "all" || m.source_type === filter) &&
        (!term || [m.title, m.topic, m.summary].some((s) => s?.toLowerCase().includes(term))),
    );
    const map = new Map<string, { label: string; items: MaterialListItem[]; cards: number }>();
    for (const m of filtered) {
      const d = new Date(m.created_at);
      const key = monthKey(d);
      const label = format(d, "LLLL yyyy", { locale: it });
      const g = map.get(key) ?? { label: label.charAt(0).toUpperCase() + label.slice(1), items: [], cards: 0 };
      g.items.push(m);
      g.cards += m.card_count;
      map.set(key, g);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, g]) => ({ key, ...g }));
  }, [materials, q, filter]);

  const totalCards = materials.reduce((s, m) => s + m.card_count, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${materials.length} lezioni · ${totalCards} schede`}
        title={
          <>
            Il tuo <span className="italic text-primary">archivio</span>
          </>
        }
        description="Lezioni, materiali e schede salvate, ordinati automaticamente per mese."
        action={
          <Button asChild>
            <Link to="/upload">
              <Plus /> Nuova lezione
            </Link>
          </Button>
        }
      />

      <BooksShelf />

      {materials.length === 0 ? (
        <EmptyState
          icon={<Library className="size-6" />}
          title="L'archivio è ancora vuoto"
          description="Carica la prima lezione: troverai qui tutti i materiali, divisi per mese."
          action={
            <Button asChild>
              <Link to="/upload">Carica una lezione</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cerca per titolo o argomento"
                className="h-11 rounded-full bg-paper pl-10"
                aria-label="Cerca nell'archivio"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                    filter === f.id ? "border-foreground bg-foreground text-background" : "border-border bg-paper hover:border-foreground/30",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nessun risultato per questa ricerca.</p>
          ) : (
            <div className="space-y-10">
              {groups.map((g, gi) => (
                <section key={g.key} className="animate-rise" style={{ animationDelay: `${gi * 60}ms` }}>
                  <div className="sticky top-16 z-10 -mx-1 mb-4 flex items-baseline justify-between bg-background/90 px-1 py-2 backdrop-blur">
                    <h2 className="font-display text-2xl font-medium sm:text-[1.75rem]">{g.label}</h2>
                    <span className="eyebrow">
                      {g.items.length} {g.items.length === 1 ? "lezione" : "lezioni"} · {g.cards} schede
                    </span>
                  </div>
                  <div className="ledger-rule mb-4" />
                  <ul className="grid gap-3 md:grid-cols-2">
                    {g.items.map((m) => {
                      const d = new Date(m.created_at);
                      return (
                        <li key={m.id}>
                          <Link
                            to="/library/$materialId"
                            params={{ materialId: m.id }}
                            className="paper group flex h-full gap-4 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift sm:p-5"
                          >
                            <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-background py-2">
                              <span className="font-display text-2xl font-medium leading-none">{format(d, "d")}</span>
                              <span className="eyebrow mt-1 text-[9px]">{format(d, "EEE", { locale: it })}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="line-clamp-2 font-display text-lg font-medium leading-snug">{m.title}</h3>
                                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                              </div>
                              {m.summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.summary}</p>}
                              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <SourceIcon type={m.source_type} className="size-3.5" /> {sourceLabel(m.source_type)}
                                </span>
                                <span>·</span>
                                <span className="font-semibold text-foreground">{m.card_count} schede</span>
                                {m.topic && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate">{m.topic}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
