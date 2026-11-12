// Answer checking for typed and spoken answers.

export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\b(to|a|an|the)\b\s+/g, (m, _w, offset) => (offset === 0 ? "" : m))
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export type GradeResult = { correct: boolean; close: boolean; similarity: number };

/**
 * Typed answers tolerate one small typo for words of 5+ letters.
 * Spoken answers also pass when the transcript contains the expected phrase.
 */
export function gradeAnswer(answer: string, expected: string, mode: "typed" | "voice" = "typed"): GradeResult {
  const a = normalizeAnswer(answer);
  const variants = expected
    .split(/\s*[/|;]\s*/)
    .map(normalizeAnswer)
    .filter(Boolean);
  if (!a || variants.length === 0) return { correct: false, close: false, similarity: 0 };

  let best = 0;
  for (const e of variants) {
    if (a === e) return { correct: true, close: false, similarity: 1 };
    if (mode === "voice" && (` ${a} `).includes(` ${e} `)) return { correct: true, close: false, similarity: 1 };
    const dist = levenshtein(a, e);
    const sim = 1 - dist / Math.max(a.length, e.length);
    best = Math.max(best, sim);
    const tolerance = e.length >= 5 ? 1 : 0;
    if (dist <= tolerance) return { correct: true, close: dist > 0, similarity: sim };
  }
  return { correct: false, close: best >= 0.7, similarity: best };
}
