import { useEffect, useMemo, useState } from "react";
import { Loader2, Pause, Play, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineError, Stamp } from "@/components/lexi/ui-bits";
import { buildSynonymItems, speakingTopic } from "@/lib/method-exercises";
import { coachCountsAsCorrect, SPEAKING_DURATIONS } from "@/lib/methods";
import { useCoach, type SessionProps } from "./hooks";
import { AnswerArea, CoachFeedback, coachHeading, PromptCard, ResultPanel, SessionHeader, SessionSummary, SpeakButton, useReviewRecorder, xpForAnswer } from "./session-kit";

export function SentenceSession(props: SessionProps) {
  return <WritingSession {...props} method="sentence_creation" />;
}
export function SynonymsSession(props: SessionProps) {
  return <WritingSession {...props} method="synonyms_paraphrasing" />;
}

function WritingSession({ cards, onExit, onRestart, method }: SessionProps & { method: "sentence_creation" | "synonyms_paraphrasing" }) {
  const rec = useReviewRecorder(method);
  const coach = useCoach();
  const items = useMemo(() => buildSynonymItems(cards), [cards]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [override, setOverride] = useState(false);
  const card = cards[index];
  if (!card) return <SessionSummary method={method} cards={cards} {...rec} onExit={onExit} onRestart={onRestart} />;
  const task = items[index]?.task ?? "synonym";
  const sentence = method === "sentence_creation";
  const check = () => {
    if (!answer.trim() || coach.loading) return;
    void coach.run(sentence ? { method, cardId: card.id, answer: answer.trim() } : { method, cardId: card.id, task, answer: answer.trim() });
  };
  const correct = coach.result ? override || coachCountsAsCorrect(coach.result.verdict) : false;
  const next = () => {
    if (coach.loading) return;
    if (coach.result) rec.save(card.id, correct, "typed", answer.trim());
    setIndex((i) => i + 1);
    setAnswer("");
    setOverride(false);
    coach.reset();
  };
  return <div className="mx-auto max-w-2xl pb-16">
    <SessionHeader method={method} done={index} total={cards.length} xp={rec.xp} onExit={onExit} />
    <PromptCard eyebrow={sentence ? "Crea una frase originale" : task === "synonym" ? "Trova un sinonimo" : "Riscrivi con parole diverse"} aside={<Stamp tone="green">Correzione AI</Stamp>}>
      <div className="flex items-center gap-2"><p className="font-display text-3xl italic break-words">{card.term}</p><SpeakButton text={card.term} /></div>
      {sentence ? <p className="mt-3 text-sm text-muted-foreground">{card.meaning}</p> : task === "paraphrase" ? <p className="mt-4 font-display text-xl">{card.example}</p> : <p className="mt-3 text-sm text-muted-foreground">{card.definition || card.meaning}</p>}
    </PromptCard>
    {!coach.result ? <div className="mt-5 space-y-3" key={card.id}>
      <AnswerArea value={answer} onChange={setAnswer} label={sentence ? "La tua frase" : "Sinonimo o parafrasi"} placeholder={sentence ? "Scrivi una frase in inglese con questa parola…" : task === "synonym" ? "Scrivi un sinonimo in inglese…" : "Riscrivi la frase mantenendo il significato…"} autoFocus />
      {coach.error && <InlineError title="Correzione non riuscita" message={coach.error} onRetry={check} />}
      <div className="flex justify-between"><Button variant="ghost" disabled={coach.loading} onClick={next}>Salta</Button><Button onClick={check} disabled={!answer.trim() || coach.loading}>{coach.loading && <Loader2 className="animate-spin" />} Verifica</Button></div>
    </div> : <ResultPanel ok={correct} heading={override ? "Segnata come giusta" : coachHeading(coach.result.verdict)} xp={xpForAnswer(correct, "typed")} onContinue={next} onOverride={!correct ? () => setOverride(true) : undefined}><CoachFeedback result={coach.result} /></ResultPanel>}
  </div>;
}

export function SpeakingSession({ cards, data, onExit, onRestart }: SessionProps) {
  const rec = useReviewRecorder("speaking_challenge");
  const [words] = useState(() => cards.slice(0, 5));
  const [duration, setDuration] = useState<number>(60);
  const [remaining, setRemaining] = useState(60);
  const [stage, setStage] = useState<"ready" | "speaking" | "assess" | "done">("ready");
  const [running, setRunning] = useState(false);
  const [used, setUsed] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!running || stage !== "speaking") return;
    const end = Date.now() + remaining * 1000;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) { setRunning(false); setStage("assess"); }
    }, 200);
    return () => clearInterval(timer);
    // remaining is captured once per start/resume; it must not reset the deadline on each tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, stage]);
  if (stage === "done") return <SessionSummary method="speaking_challenge" cards={words} {...rec} onExit={onExit} onRestart={onRestart} />;
  const topic = speakingTopic(words, data.materials);
  return <div className="mx-auto max-w-2xl pb-16">
    <SessionHeader method="speaking_challenge" done={0} total={words.length} xp={rec.xp} onExit={onExit} />
    <PromptCard eyebrow="Il tuo argomento" aside={<Stamp tone="camel">Speaking</Stamp>}>
      <h1 className="font-display text-2xl break-words">{topic}</h1>
      <ul className="mt-5 flex flex-wrap gap-2">{words.map((c) => <li className="rounded-lg border border-primary/30 bg-success-soft px-3 py-2 font-display text-lg italic text-primary" key={c.id}>{c.term}</li>)}</ul>
    </PromptCard>
    {stage === "assess" ? <section className="mt-6 space-y-4">
      <h2 className="text-xl font-medium">Quali parole hai usato bene?</h2>
      {words.map((c) => <label className="flex items-center gap-3 border-b border-border py-3" key={c.id}><Checkbox checked={used.has(c.id)} onCheckedChange={(v) => setUsed((s) => { const n = new Set(s); if (v === true) n.add(c.id); else n.delete(c.id); return n; })} /><span><span className="font-semibold">{c.term}</span><span className="ml-2 text-sm text-muted-foreground">{c.meaning}</span></span></label>)}
      <Button onClick={() => { for (const c of words) rec.save(c.id, used.has(c.id), "voice", used.has(c.id) ? "Autovalutazione: usata bene" : "Autovalutazione: da allenare"); setStage("done"); }}>Conferma autovalutazione</Button>
    </section> : <div className="mt-7 space-y-5 text-center">
      {stage === "ready" && <div className="flex justify-center gap-2" role="radiogroup" aria-label="Durata">{SPEAKING_DURATIONS.map((d) => <Button key={d} role="radio" aria-checked={duration === d} variant={duration === d ? "default" : "outline"} onClick={() => { setDuration(d); setRemaining(d); }}>{d / 60} {d === 60 ? "minuto" : "minuti"}</Button>)}</div>}
      <div className="flex items-center justify-center gap-3 font-mono text-5xl tabular-nums" role="timer" aria-label="Tempo rimanente"><Timer className="size-7 text-camel" />{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</div>
      {stage === "ready" ? <Button size="lg" onClick={() => { setStage("speaking"); setRunning(true); }}><Play /> Inizia a parlare</Button> : <div className="flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={() => setRunning((v) => !v)}>{running ? <Pause /> : <Play />}{running ? "Pausa" : "Riprendi"}</Button><Button onClick={() => { setRunning(false); setStage("assess"); }}>Ho finito</Button></div>}
    </div>}
  </div>;
}
