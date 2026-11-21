import { describe, expect, it } from "vitest";
import { bookRanges, validatePdfSize } from "../lib/book-rules";

describe("Libri PDF", () => {
  it("divide automaticamente 148 pagine senza perdere o ripetere pagine", () => {
    const parts = bookRanges(148, "automatic");
    expect(parts).toHaveLength(10);
    expect(parts[0]).toEqual({ start: 1, end: 15 });
    expect(parts[9]).toEqual({ start: 136, end: 148 });
    expect(parts.flatMap(p => Array.from({ length: p.end - p.start + 1 }, (_, i) => p.start + i))).toEqual(Array.from({ length: 148 }, (_, i) => i + 1));
  });
  it("analizza solo le pagine scelte 45–58", () => {
    expect(bookRanges(148, "pages", 45, 58)).toEqual([{ start: 45, end: 58 }]);
  });
  it("suddivide anche intervalli lunghi senza aggiungere pagine esterne", () => {
    expect(bookRanges(148, "pages", 45, 75)).toEqual([{ start: 45, end: 59 }, { start: 60, end: 74 }, { start: 75, end: 75 }]);
  });
  it("rifiuta intervalli invertiti, fuori documento o frazionari", () => {
    for (const [start, end] of [[0, 10], [10, 9], [1, 149], [1.5, 4]]) {
      expect(() => bookRanges(148, "pages", start, end)).toThrow();
    }
  });
  it("accetta libri oltre 10 MB fino al limite reale di 5 GB", () => {
    expect(() => validatePdfSize(200 * 1024 * 1024)).not.toThrow();
    expect(() => validatePdfSize(5 * 1024 ** 3)).not.toThrow();
    expect(() => validatePdfSize(5 * 1024 ** 3 + 1)).toThrow();
    expect(() => validatePdfSize(0)).toThrow();
  });
});