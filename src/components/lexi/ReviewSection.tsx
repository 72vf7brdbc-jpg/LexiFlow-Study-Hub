import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, Brain, CalendarClock, ClipboardCheck, Languages, Link2, MessageCircle, Mic, PenLine, RefreshCw, ScanText, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/lexi/ui-bits";
import { CATEGORIES, METHODS, methodInfo, pickSession, poolFor, type MethodId } from "@/lib/methods";
import { mistakePhase } from "@/lib/mistakes";
import type { ReviewCard, ReviewData } from "@/lib/queries";
import { ActiveRecallSession, RetrievalSession, SpacedRepetitionSession } from "./review/memory-sessions";
import { CollocationsSession, ContextualSession, TranslationSession } from "./review/vocabulary-sessions";
import { SentenceSession, SpeakingSession, SynonymsSession } from "./review/production-sessions";
import { ErrorSession } from "./review/error-session";
import type { SessionProps } from "./review/hooks";
import { GrammarBanner, GrammarWorkspace } from "./review/grammar-section";

const ICONS = { active_recall: Brain, spaced_repetition: CalendarClock, retrieval_practice: ClipboardCheck, collocations: Link2, contextual_learning: ScanText, translation_practice: Languages, sentence_creation: PenLine, synonyms_paraphrasing: MessageCircle, speaking_challenge: Mic, error_based: RefreshCw };
const SESSIONS: Record<MethodId, React.ComponentType<SessionProps>> = { active_recall: ActiveRecallSession, spaced_repetition: SpacedRepetitionSession, retrieval_practice: RetrievalSession, collocations: CollocationsSession, contextual_learning: ContextualSession, translation_practice: TranslationSession, sentence_creation: SentenceSession, synonyms_paraphrasing: SynonymsSession, speaking_challenge: SpeakingSession, error_based: ErrorSession };

type Props = { data: ReviewData; method?: MethodId | undefined; material?: string | undefined; onSelect: (method: MethodId | undefined) => void; onClearMaterial: () => void };
export default function ReviewSection({ data, method, material, onSelect, onClearMaterial }: Props) {
  const [run, setRun] = useState<{ method: MethodId; cards: ReviewCard[]; data: ReviewData; key: number } | null>(null);
  const [grammarOpen, setGrammarOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  if (grammarOpen) return <GrammarWorkspace material={material} onClose={() => setGrammarOpen(false)} />;
  const cards = material ? data.cards.filter((c) => c.material_id === material) : data.cards;
  const lesson = data.materials.find((m) => m.id === material);
  const exit = () => { setRun(null); onSelect(undefined); };
  if (run && run.method === method) {
    const Session = SESSIONS[run.method];
    return <Session key={run.key} cards={run.cards} data={run.data} onExit={exit} onRestart={() => { setRun(null); }} />;
  }
  if (method) {
    const info = methodInfo(method);
    const lessonsWithCards = data.materials.filter((m) => cards.some((c) => c.material_id === m.id));
    const scoped = picked.length ? cards.filter((c) => picked.includes(c.material_id)) : cards;
    const pool = poolFor(method, scoped, { mistakes: data.mistakes });
    const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
    const Icon = ICONS[method];
    return <div className="mx-auto max-w-2xl pb-12 animate-rise">
      <Button variant="ghost" onClick={exit}><ArrowLeft /> Tutti i metodi</Button>
      <div className="mt-8 flex items-center gap-3"><Icon className="size-8 text-primary" /><Stamp tone="green">{CATEGORIES.find((c) => c.id === info.category)?.label}</Stamp>{info.ai && <Stamp tone="camel">AI</Stamp>}</div>
      <h1 className="mt-5 font-display text-3xl font-medium break-words">{info.name}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">{info.intro}</p>
      <ol className="mt-7 divide-y divide-border border-y border-border">{info.steps.map((step, i) => <li className="flex items-center gap-4 py-4" key={step}><span className="font-mono text-sm text-camel">0{i + 1}</span><span>{step}</span></li>)}</ol>
      {lessonsWithCards.length > 1 && <section className="mt-7" aria-label="Scegli le lezioni"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-lg font-medium">Quali lezioni vuoi ripassare?</h2>{picked.length > 0 && <Button size="sm" variant="ghost" onClick={() => setPicked([])}>Tutte</Button>}</div><p className="mt-1 text-sm text-muted-foreground">{picked.length ? `${picked.length} selezionate` : "Nessuna scelta: uso tutte le lezioni."}</p><div className="mt-3 flex flex-wrap gap-2">{lessonsWithCards.map((m) => { const on = picked.includes(m.id); const n = cards.filter((c) => c.material_id === m.id).length; return <Button key={m.id} size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => toggle(m.id)} className="h-auto max-w-full whitespace-normal rounded-full py-2 text-left"><span className="break-words">{m.title}</span><span className="font-mono text-xs opacity-70">{n}</span></Button>; })}</div></section>}
      {pool.length >= info.min ? <div className="mt-7 flex flex-wrap items-center justify-between gap-4"><span className="text-sm text-muted-foreground">{Math.min(pool.length, info.size)} parole{picked.length ? ` da ${picked.length} ${picked.length === 1 ? "lezione" : "lezioni"}` : lesson ? ` · ${lesson.title}` : " dalle tue lezioni"}</span><Button size="lg" onClick={() => setRun({ method, cards: pickSession(method, pool), data, key: Date.now() })}>Inizia <ArrowRight /></Button></div> : <div className="mt-7 space-y-4"><p className="text-muted-foreground">{info.needs}</p>{cards.length === 0 && <Button asChild><Link to="/upload">Carica una lezione</Link></Button>}</div>}
    </div>;
  }
  const pendingTasks = data.tasks.filter((t) => t.status !== "done" && (!material || t.material_id === material));
  const waiting = data.mistakes.filter((m) => mistakePhase(m) === "waiting").length;
  return <div className="mx-auto max-w-5xl pb-12 animate-rise">
    <GrammarBanner onOpen={() => setGrammarOpen(true)} />
    <section aria-label="Da fare" className="mb-8 rounded-lg border border-camel bg-gold/20 px-4 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-4"><h2 className="flex items-center gap-2 font-display text-xl font-medium"><ClipboardCheck className="size-5 text-accent-foreground" /> Da fare</h2><span className="font-mono text-xs text-accent-foreground">{pendingTasks.length} in sospeso</span></div>
      {pendingTasks.length ? <ul className="mt-3 divide-y divide-camel/40">{pendingTasks.map((task) => <li key={task.id}><Button asChild variant="ghost" className="h-auto w-full justify-between rounded-none px-0 py-3 text-left whitespace-normal"><Link to="/library/$materialId" params={{ materialId: task.material_id }}><span className="min-w-0"><span className="block font-semibold break-words">{task.description}</span><span className="mt-1 block text-xs text-muted-foreground">{data.materials.find((m) => m.id === task.material_id)?.title} · {task.status === "in_progress" ? "In corso" : "Da iniziare"}{task.due_date ? ` · ${new Date(`${task.due_date}T12:00:00`).toLocaleDateString("it-IT")}` : ""}</span></span><ArrowRight className="shrink-0" /></Link></Button></li>)}</ul> : <p className="mt-2 text-sm text-accent-foreground">Nessun compito in sospeso.</p>}
    </section>
    <header className="mb-8"><p className="eyebrow text-primary">Le tue parole, il tuo ritmo</p><h1 className="mt-2 text-3xl font-medium">Ripasso</h1><div className="mt-3 flex flex-wrap items-center gap-3"><span className="text-sm text-muted-foreground">{cards.length} parole · {poolFor("spaced_repetition", cards).length} in scadenza oggi</span>{lesson && <Button size="sm" variant="secondary" onClick={onClearMaterial} className="max-w-full h-auto py-2 whitespace-normal"><BookOpen /><span className="break-words">{lesson.title}</span><X /></Button>}</div></header>
    <div className="space-y-9">{CATEGORIES.map((cat) => <section key={cat.id}><h2 className="mb-4 border-b border-border pb-3 font-display text-xl font-medium">{cat.label}</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{METHODS.filter((m) => m.category === cat.id).map((m) => {
      const Icon = ICONS[m.id];
      const count = poolFor(m.id, cards, { mistakes: data.mistakes }).length;
      return <Button variant="outline" key={m.id} onClick={() => onSelect(m.id)} className="group h-auto min-h-48 w-full flex-col items-start justify-between whitespace-normal rounded-lg p-5 text-left hover:border-primary/50 hover:shadow-soft">
        <div className="w-full"><div className="mb-4 flex items-center justify-between"><Icon className="size-5 text-primary" />{m.ai && <Sparkles className="size-4 text-camel" />}</div><h3 className="text-base font-semibold break-words">{m.name}</h3><p className="mt-2 text-sm font-normal leading-relaxed text-muted-foreground">{m.tagline}</p></div><div className="mt-5 flex w-full items-center justify-between gap-2 text-xs text-primary"><span>{count >= m.min ? `${count} parole disponibili` : m.id === "error_based" && waiting ? `${waiting} in attesa di verifica` : count === 0 ? "Nessuna parola disponibile" : `Servono almeno ${m.min} parole`}</span><ArrowRight /></div>
      </Button>;
    })}</div></section>)}</div>
  </div>;
}
