import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Save, Loader2 } from "lucide-react";
import { addGrammar } from "@/lib/grammar.functions";
import { grammarContentSchema, GRAMMAR_KINDS } from "@/lib/grammar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ManualGrammarForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const save = useServerFn(addGrammar);
  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [formation, setFormation] = useState("");
  const [en, setEn] = useState("");
  const [it, setIt] = useState("");
  const [exercises, setExercises] = useState(GRAMMAR_KINDS.map((kind) => ({ kind, prompt: "", answer: "", explanation: "", options: "" })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const names = { gap: "Completa la frase", choice: "Scelta multipla", correction: "Correggi l’errore", transformation: "Trasforma la frase" };
  const field = (label: string, value: string, onChange: (value: string) => void, maxLength: number) => <label className="block space-y-2 text-sm font-semibold">{label}<Textarea aria-label={label} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} disabled={busy} /></label>;
  const update = (index: number, key: "prompt" | "answer" | "explanation" | "options", value: string) => setExercises((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  async function submit() {
    const parsed = grammarContentSchema.safeParse({ title, overview, formation, uses: [overview], examples: [{ en, it }], pitfalls: [], source_quote: null, exercises: exercises.map((row) => ({ ...row, options: row.kind === "choice" ? row.options.split("\n").map((option) => option.trim()).filter(Boolean) : [] })) });
    if (!parsed.success) { setError("Completa teoria, esempio e quattro esercizi. La frase da completare deve contenere _____. Per la scelta multipla inserisci 3–4 opzioni diverse, una per riga, inclusa la soluzione."); return; }
    setBusy(true); setError("");
    try { const result = await save({ data: { source: "manual", content: parsed.data } }); if (!result.ok) setError(result.message); else await onSaved(); }
    catch { setError("Non è stato possibile salvare. Controlla la connessione."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-6">
    <label className="block space-y-2 text-sm font-semibold">Titolo della regola<Input aria-label="Titolo della regola" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} disabled={busy} /></label>
    {field("Quando e perché", overview, setOverview, 1200)}
    {field("Come si forma", formation, setFormation, 1000)}
    <div className="grid gap-4 sm:grid-cols-2">{field("Esempio in inglese", en, setEn, 500)}{field("Traduzione dell’esempio", it, setIt, 500)}</div>
    {exercises.map((row, i) => <fieldset key={row.kind} className="space-y-4 border-t border-border pt-5"><legend className="font-display text-lg">{i + 1}. {names[row.kind]}</legend>
      {field(`Consegna ${i + 1}`, row.prompt, (value) => update(i, "prompt", value), 800)}
      {row.kind === "choice" && field("Opzioni (una per riga)", row.options, (value) => update(i, "options", value), 1200)}
      {field(`Soluzione ${i + 1}`, row.answer, (value) => update(i, "answer", value), 600)}
      {field(`Spiegazione ${i + 1}`, row.explanation, (value) => update(i, "explanation", value), 800)}
    </fieldset>)}
    {error && <p role="alert" className="text-sm text-burgundy">{error}</p>}
    <Button variant="grammar" disabled={busy} type="submit">{busy ? <Loader2 className="animate-spin" /> : <Save />} Salva regola ed esercizi</Button>
  </form>;
}