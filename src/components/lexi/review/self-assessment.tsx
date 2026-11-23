import { Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SelfAssessment({ reference, onAssess }: { reference: string; onAssess: (correct: boolean) => void }) {
  return <section className="mt-6 space-y-4 border-y border-border py-6">
    <h2 className="font-display text-xl">Autovalutazione</h2>
    <p className="whitespace-pre-line leading-relaxed">{reference}</p>
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => onAssess(true)}><Check /> La mia risposta è corretta</Button>
      <Button variant="outline" onClick={() => onAssess(false)}><RotateCcw /> Da ripassare</Button>
    </div>
  </section>;
}