import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, BookOpen, Check, GraduationCap, Loader2, PenLine, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { grammarQuery } from "@/lib/grammar-queries";
import { addGrammar, checkGrammar } from "@/lib/grammar.functions";
import { grammarProgress, type GrammarRule } from "@/lib/grammar";
import { cn } from "@/lib/utils";
import { GrammarTheory } from "./grammar-theory";

export function GrammarBanner({ onOpen }: { onOpen: () => void }) {
  const { data } = useSuspenseQuery(grammarQuery);
  return <section aria-label="Grammatica" className="mb-5 rounded-lg border border-grammar bg-grammar px-5 py-6 text-grammar-foreground sm:px-7">
    <div className="flex flex-wrap items-center justify-between gap-5">
      <div className="flex min-w-0 items-start gap-4"><GraduationCap className="mt-1 size-8 shrink-0" /><div><p className="font-mono text-xs uppercase">Il tuo quaderno di regole</p><h2 className="mt-1 font-display text-3xl font-medium">Grammatica</h2><p className="mt-2 text-sm">{data.rules.length ? `${data.rules.length} ${data.rules.length === 1 ? "argomento" : "argomenti"} · Teoria e pratica` : "Teoria e pratica · Dalle lezioni e dai tuoi dubbi"}</p></div></div>
      <Button variant="outline" onClick={onOpen} className="border-grammar-foreground/40 bg-transparent text-grammar-foreground hover:bg-grammar-foreground/15 hover:text-grammar-foreground">Apri il quaderno <ArrowRight /></Button>
    </div>
  </section>;
}
const exerciseNames = { gap: "Completa la frase", choice: "Scegli la forma corretta", correction: "Trova e correggi l’errore", transformation: "Trasforma la frase" };
type Feedback = { correct: boolean; feedback: string; natural_answer: string };
export function GrammarWorkspace({ onClose, material }: { onClose: () => void; material?: string | undefined }) {
  const { data } = useSuspenseQuery(grammarQuery);
  const queryClient = useQueryClient();
  const add = useServerFn(addGrammar);
  const check = useServerFn(checkGrammar);
  const [view, setView] = useState<"list" | "new" | "theory" | "practice" | "summary">("list");
  const [rule, setRule] = useState<GrammarRule | null>(null);
  const [source, setSource] = useState<"request" | "manual" | "lesson">("request");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [lessonId, setLessonId] = useState(material ?? "");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [results, setResults] = useState<Feedback[]>([]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["grammar"] });
  const resetPractice = () => { setIndex(0); setAnswer(""); setFeedback(null); setResults([]); setError(null); setView("practice"); };
  const back = () => { setError(null); setNotice(null); if (view === "list") onClose(); else setView("list"); };
  async function create() {
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await add({ data: { source, ...(source === "lesson" ? { materialId: lessonId } : { text: source === "manual" ? `${topic}\n\nTeoria inserita dall’utente:\n${notes}` : topic }) } });
      if (!result.ok) { setError(result.message); return; }
      await refresh();
      setNotice(result.count ? `${result.count} ${result.count === 1 ? "argomento aggiunto" : "argomenti aggiunti"}.` : "Non sono state trovate regole di grammatica esplicitamente insegnate in questa lezione.");
      setTopic(""); setNotes(""); setView("list");
    } catch { setError("La richiesta non è stata completata. Il testo è rimasto qui."); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!rule || busy || feedback || !answer.trim()) return;
    setBusy(true); setError(null);
    try {
      const result = await check({ data: { ruleId: rule.id, index, answer } });
      if (!result.ok) { setError(result.message); return; }
      setFeedback(result.result); setResults((prev) => [...prev, result.result]); await refresh(); await queryClient.invalidateQueries({ queryKey: ["review-progress"] });
    } catch { setError("Non è stato possibile correggere e salvare la risposta. Riprova."); }
    finally { setBusy(false); }
  }
  const exercise = rule?.content.exercises[index];
  const currentRule = data.rules.find((item) => item.id === rule?.id) ?? rule;
  const filtered = data.rules.filter((r) => (!material || r.material_id === material || r.material_id === null) && r.title.toLowerCase().includes(search.toLowerCase()));
  return <div className="mx-auto max-w-4xl pb-12 animate-rise">
    <Button variant="ghost" onClick={back} disabled={busy}><ArrowLeft />{view === "list" ? "Torna al Ripasso" : "Il quaderno di grammatica"}</Button>
    <header className="mt-6 border-b-2 border-grammar pb-6"><p className="font-mono text-xs uppercase text-grammar">Grammatica · Teoria e pratica</p><h1 className="mt-2 break-words font-display text-3xl font-medium">{view === "new" ? "Una regola, un dubbio" : rule && ["theory", "practice", "summary"].includes(view) ? rule.title : "Il tuo quaderno di grammatica"}</h1></header>
    {error && <p role="alert" className="mt-5 rounded-lg border border-grammar/30 bg-danger-soft p-4 text-sm text-burgundy">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-lg bg-success-soft p-4 text-sm text-success">{notice}</p>}
    {view === "list" && <>
      <div className="my-6 flex flex-wrap items-center gap-3"><Input aria-label="Cerca un argomento" placeholder="Cerca un argomento…" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 flex-1 basis-48" /><Button variant="grammar" onClick={() => { setView("new"); setError(null); setNotice(null); }}><Plus /> Aggiungi regola</Button></div>
      {material && <p className="mb-4 text-sm text-muted-foreground">{data.lessons.find((l) => l.id === material)?.title} · e le tue regole personali</p>}
      {filtered.length ? <div className="divide-y divide-border">{filtered.map((item) => {
        const progress = grammarProgress(data.attempts, item.id);
        return <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-6"><div className="min-w-0 flex-1 basis-48"><p className="font-mono text-xs text-grammar">{item.level} · {item.source === "lesson" ? "Dalla lezione" : item.source === "manual" ? "Regola personale" : "Su richiesta"}</p><h2 className="mt-2 break-words font-display text-xl font-medium">{item.title}</h2><p className="mt-2 text-sm text-muted-foreground">{item.material_id ? data.lessons.find((l) => l.id === item.material_id)?.title : "Il tuo quaderno personale"}</p>{progress.accuracy !== null && <p className="mt-2 text-xs text-primary">{progress.correct}/{progress.answered} risposte corrette · {progress.accuracy}%</p>}</div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setRule(item); setView("theory"); setNotice(null); }}><BookOpen /> Teoria</Button><Button variant="grammar" onClick={() => { setRule(item); resetPractice(); setNotice(null); }}>Esercitati <ArrowRight /></Button></div></div>;
      })}</div> : <div className="border-y border-border py-12 text-center"><GraduationCap className="mx-auto size-10 text-grammar" /><h2 className="mt-4 font-display text-xl">{search ? "Nessun argomento trovato" : "Il quaderno è ancora vuoto"}</h2><p className="mt-2 text-sm text-muted-foreground">{search ? "Prova un altro argomento." : "Le regole delle nuove lezioni appariranno qui."}</p></div>}
    </>}
    {view === "new" && <div className="mt-7 space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Origine della regola">{(["request", "manual", "lesson"] as const).map((s) => <Button key={s} role="tab" aria-selected={source === s} variant={source === s ? "grammar" : "outline"} onClick={() => { setSource(s); setError(null); }} disabled={busy}>{s === "request" ? <Sparkles /> : s === "manual" ? <PenLine /> : <BookOpen />}{s === "request" ? "Chiedi all’AI" : s === "manual" ? "Scrivi una regola" : "Da una lezione passata"}</Button>)}</div>
      {source === "lesson" ? <div className="space-y-2"><label htmlFor="grammar-lesson" className="text-sm font-semibold">Lezione</label><select id="grammar-lesson" value={lessonId} onChange={(e) => setLessonId(e.target.value)} disabled={busy} className="h-12 w-full min-w-0 rounded-lg border border-input bg-paper px-3 text-sm"><option value="">Scegli una lezione</option>{data.lessons.filter((l) => !l.grammar_extracted_at).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>{data.lessons.every((l) => l.grammar_extracted_at) && <p className="text-sm text-muted-foreground">Non ci sono lezioni ancora da analizzare.</p>}</div> : <div className="space-y-5"><div className="space-y-2"><label htmlFor="grammar-topic" className="text-sm font-semibold">Argomento o dubbio</label><Input id="grammar-topic" value={topic} maxLength={500} onChange={(e) => setTopic(e.target.value)} placeholder="Es. Present perfect e past simple: quando usarli?" disabled={busy} /></div>{source === "manual" && <div className="space-y-2"><label htmlFor="grammar-notes" className="text-sm font-semibold">La tua regola o gli appunti della slide</label><Textarea id="grammar-notes" value={notes} maxLength={10000} onChange={(e) => setNotes(e.target.value)} placeholder="Scrivi la spiegazione che vuoi approfondire…" className="min-h-40" disabled={busy} /></div>}</div>}
      <Button variant="grammar" onClick={create} disabled={busy || (source === "lesson" ? !lessonId : topic.trim().length < 3 || (source === "manual" && notes.trim().length < 3))}>{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}{busy ? "Preparo teoria ed esercizi…" : source === "lesson" ? "Estrai la grammatica" : "Aggiungi al quaderno"}</Button>
    </div>}
    {view === "theory" && currentRule && <GrammarTheory key={currentRule.id} rule={currentRule} notes={data.notes} onPractice={resetPractice} refresh={refresh} />}
    {view === "practice" && rule && exercise && <div className="mt-7 space-y-6">
      <div className="flex items-center justify-between text-sm"><span className="font-mono text-grammar">{index + 1} / {rule.content.exercises.length}</span><Button variant="ghost" onClick={() => setView("theory")} disabled={busy}>Rivedi la teoria <BookOpen /></Button></div>
      <h2 className="font-display text-xl">{exerciseNames[exercise.kind]}</h2><p className="whitespace-pre-line text-lg leading-relaxed">{exercise.prompt}</p>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
        {exercise.kind === "choice" ? <div className="grid gap-3 sm:grid-cols-2">{exercise.options.map((option) => <Button key={option} type="button" variant={answer === option ? "grammar" : "outline"} aria-pressed={answer === option} onClick={() => setAnswer(option)} disabled={busy || !!feedback} className="h-auto min-h-12 whitespace-normal rounded-lg p-4 text-left">{option}</Button>)}</div> : <div className="space-y-2"><label htmlFor="grammar-answer" className="text-sm font-semibold">La tua risposta</label><Textarea id="grammar-answer" value={answer} maxLength={600} onChange={(e) => setAnswer(e.target.value)} disabled={busy || !!feedback} className="min-h-28" /></div>}
        {!feedback && <Button type="submit" variant="grammar" disabled={busy || !answer.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Check />}{busy ? "Correggo e salvo…" : "Controlla risposta"}</Button>}
      </form>
      {feedback && <div className={cn("space-y-4 border-y py-6", feedback.correct ? "border-success" : "border-grammar")}><h3 className={cn("font-display text-xl", feedback.correct ? "text-success" : "text-grammar")}>{feedback.correct ? "Corretto!" : "Rivediamo la regola"}</h3><p className="leading-relaxed">{feedback.feedback}</p><div><p className="text-xs font-semibold text-muted-foreground">Una soluzione corretta</p><p className="mt-2 font-semibold">{feedback.natural_answer}</p></div><p className="text-xs text-muted-foreground">Risultato salvato nel quaderno.</p><Button variant="grammar" onClick={() => { if (index + 1 >= rule.content.exercises.length) setView("summary"); else { setIndex((i) => i + 1); setAnswer(""); setFeedback(null); setError(null); } }}>{index + 1 >= rule.content.exercises.length ? "Vedi il risultato" : "Prossimo esercizio"}<ArrowRight /></Button></div>}
    </div>}
    {view === "summary" && rule && <div className="mt-10 space-y-6 text-center"><GraduationCap className="mx-auto size-12 text-grammar" /><h2 className="font-display text-2xl">Un passo avanti nella grammatica</h2><p className="text-lg">{results.filter((r) => r.correct).length} / {results.length} risposte corrette</p><div className="flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={() => setView("theory")}><BookOpen /> Rivedi la teoria</Button><Button variant="grammar" onClick={resetPractice}>Ripeti gli esercizi <ArrowRight /></Button></div><Button variant="ghost" onClick={() => setView("list")}>Torna al quaderno</Button></div>}
  </div>;
}
