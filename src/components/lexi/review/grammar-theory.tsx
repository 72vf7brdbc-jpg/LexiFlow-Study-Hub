import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BookOpen, Check, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askGrammarClarification, improveGrammarTheory } from "@/lib/grammar.functions";
import { notesForGrammarRule, type GrammarNote, type GrammarRule } from "@/lib/grammar";

export function GrammarTheory({ rule, notes, onPractice, refresh }: { rule: GrammarRule; notes: GrammarNote[]; onPractice: () => void; refresh: () => Promise<void> }) {
  const improve = useServerFn(improveGrammarTheory);
  const ask = useServerFn(askGrammarClarification);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const section = useRef<HTMLElement>(null);
  const teaching = rule.content.teaching;
  const personalNotes = notesForGrammarRule(notes, rule.id);
  async function upgrade() {
    if (upgrading || asking) return;
    setUpgrading(true); setError(null);
    try {
      const result = await improve({ data: { ruleId: rule.id } });
      if (!result.ok) { setError(result.message); return; }
      await refresh();
    } catch { setError("Non è stato possibile aggiornare la teoria. La regola originale è ancora disponibile."); }
    finally { setUpgrading(false); }
  }
  async function submit() {
    if (asking || upgrading || question.trim().length < 3) return;
    setAsking(true); setError(null); setSaved(false);
    try {
      const result = await ask({ data: { ruleId: rule.id, question } });
      if (!result.ok) { setError(result.message); return; }
      await refresh(); setQuestion(""); setSaved(true);
    } catch { setError("Il chiarimento non è stato completato. La tua domanda è rimasta qui."); }
    finally { setAsking(false); }
  }
  return <article className="mt-7 space-y-7">
    <div className="flex flex-wrap gap-2 text-xs text-grammar"><span>{rule.level}</span><span>·</span><span>{rule.source === "lesson" ? "Dalla lezione, con approfondimenti AI" : "Approfondimento AI su tua richiesta"}</span></div>
    {rule.content.source_quote && <div className="border-l-2 border-grammar pl-4"><p className="text-xs font-semibold text-grammar">Dalla tua lezione</p><blockquote className="mt-2 whitespace-pre-line text-sm italic text-muted-foreground">{rule.content.source_quote}</blockquote></div>}
    {!teaching && <Button variant="outline" onClick={upgrade} disabled={upgrading || asking} className="h-auto min-h-11 whitespace-normal">{upgrading ? <Loader2 className="animate-spin" /> : <Sparkles />}{upgrading ? "Preparo una spiegazione più chiara…" : "Rendi più chiara questa scheda"}</Button>}
    <section><h2 className="font-display text-xl">Quando e perché</h2><p className="mt-3 whitespace-pre-line leading-relaxed">{teaching?.overview ?? rule.content.overview}</p></section>
    {teaching && <section className="border-l-2 border-grammar pl-4"><h2 className="font-display text-xl">Parole spia e indizi</h2><p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{teaching.recognition}</p>{teaching.markers.length > 0 && <dl className="mt-4 space-y-3">{teaching.markers.map((marker, i) => <div key={i} className="flex flex-wrap items-start gap-2"><dt className="rounded-md bg-danger-soft px-2 py-1 font-mono text-sm font-semibold text-grammar">{marker.term}</dt><dd className="min-w-0 flex-1 basis-56 text-sm leading-relaxed">{marker.explanation}</dd></div>)}</dl>}</section>}
    <section className="border-y border-border py-5"><h2 className="font-display text-xl">Come si forma</h2>{teaching ? <>
      <div className="mt-4 divide-y divide-border" role="table" aria-label="Formazione della regola">
        {teaching.forms.map((form, i) => <div key={i} role="row" className="grid min-w-0 gap-3 py-4 sm:grid-cols-[9rem_minmax(0,1fr)]"><div role="rowheader" className="text-sm font-semibold text-grammar">{form.label}</div><div role="cell" className="min-w-0 space-y-2"><p className="break-words rounded-md bg-muted px-3 py-2 font-mono text-sm font-semibold leading-relaxed">{form.pattern}</p><p className="break-words font-semibold">{form.example}</p><p className="text-sm text-muted-foreground">{form.translation}</p></div></div>)}
      </div><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed">{teaching.formation_notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
    </> : <p className="mt-3 whitespace-pre-line leading-relaxed">{rule.content.formation}</p>}</section>
    <section><h2 className="font-display text-xl">Usi e sfumature</h2><ul className="mt-3 list-disc space-y-3 pl-5">{rule.content.uses.map((use, i) => <li key={i} className="leading-relaxed">{use}</li>)}</ul></section>
    <section><h2 className="font-display text-xl">Esempi</h2><div className="mt-3 divide-y divide-border">{rule.content.examples.map((example, i) => <div key={i} className="py-4"><p className="font-semibold">{example.en}</p><p className="mt-1 text-sm text-muted-foreground">{example.it}</p></div>)}</div></section>
    {rule.content.pitfalls.length > 0 && <section className="border-l-2 border-grammar pl-4"><h2 className="font-display text-xl">Attenzione a…</h2><ul className="mt-3 space-y-3">{rule.content.pitfalls.map((pitfall, i) => <li key={i} className="text-sm leading-relaxed">{pitfall}</li>)}</ul></section>}
    <div className="flex flex-wrap gap-3"><Button variant="grammar" size="lg" onClick={onPractice} disabled={asking || upgrading}>Passa agli esercizi <ArrowRight /></Button><Button variant="outline" size="lg" className="h-auto min-h-12 whitespace-normal" onClick={() => { setShowQuestion(true); requestAnimationFrame(() => { section.current?.scrollIntoView({ behavior: "auto", block: "start" }); input.current?.focus({ preventScroll: true }); }); }}><MessageCircle />Chiedi chiarimento all’AI</Button></div>
    <section ref={section} className="scroll-mt-6 border-t border-border pt-7" aria-label="I tuoi appunti e chiarimenti"><div className="flex items-center gap-2"><BookOpen className="size-5 text-grammar" /><h2 className="font-display text-xl">I tuoi appunti e chiarimenti</h2></div>
      {showQuestion && <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}><label htmlFor="grammar-question" className="text-sm font-semibold">Qual è il tuo dubbio?</label><Textarea ref={input} id="grammar-question" value={question} onChange={(e) => { setQuestion(e.target.value); setSaved(false); }} maxLength={1500} disabled={asking || upgrading} placeholder="Es. Perché qui si usa il present perfect e non il past simple?" className="min-h-28" /><Button type="submit" variant="grammar" disabled={asking || upgrading || question.trim().length < 3}>{asking ? <Loader2 className="animate-spin" /> : <Sparkles />}{asking ? "Preparo e salvo il chiarimento…" : "Chiedi e salva"}</Button></form>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-grammar/30 bg-danger-soft p-4 text-sm text-burgundy">{error}</p>}
      {saved && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-success"><Check className="size-4" />Chiarimento salvato nei tuoi appunti.</p>}
      <div className="mt-5 divide-y divide-border">{personalNotes.map((note) => <div key={note.id} className="py-5"><p className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleDateString("it-IT")}</p><h3 className="mt-2 whitespace-pre-line break-words font-semibold">{note.question}</h3><p className="mt-3 whitespace-pre-line break-words leading-relaxed">{note.answer}</p></div>)}</div>
    </section>
  </article>;
}