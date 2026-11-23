import { z } from "zod";

export const manualCardSchema = z.object({ term: z.string().trim().min(1).max(120), meaning: z.string().trim().min(1).max(300), example: z.string().trim().max(400) });
export function parseManualCards(text: string) {
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 1 || lines.length > 100) throw new Error("Inserisci da 1 a 100 vocaboli.");
  return lines.map((line, i) => {
    const fields = line.split("|").map((field) => field.trim());
    if (fields.length < 2 || fields.length > 3) throw new Error(`Riga ${i + 1}: inserisci parola | significato | frase (facoltativa).`);
    const parsed = manualCardSchema.safeParse({ term: fields[0], meaning: fields[1], example: fields[2] ?? "" });
    if (!parsed.success) throw new Error(`Riga ${i + 1}: parola o significato mancante o troppo lungo.`);
    return parsed.data;
  });
}