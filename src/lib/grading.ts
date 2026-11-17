
 // Answer checking for typed and spoken answers.
 // Designed for vocabulary, definitions and short expressions.

export type GradeMode = "typed" | "voice";

export type GradeResult = {
  correct: boolean;
  close: boolean;
  similarity: number;
};

// -----------------------------------------------------------------------------
// Normalization
// -----------------------------------------------------------------------------

/**
 * Normalizes text without removing meaningful words.
 *
 * - Ignores case.
 * - Normalizes Unicode characters.
 * - Handles apostrophe variants.
 * - Removes punctuation.
 * - Collapses repeated whitespace.
 *
 * Articles are deliberately preserved to avoid accepting
 * semantically different expressions as equivalent.
 */
export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// -----------------------------------------------------------------------------
// Levenshtein distance
// -----------------------------------------------------------------------------

/**
 * Calculates the minimum number of insertions, deletions
 * and substitutions needed to transform one string into another.
 *
 * Uses Unicode code points rather than UTF-16 code units.
 */
export function levenshtein(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);

  if (left.join("") === right.join("")) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  let previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );

  for (let i = 1; i <= left.length; i++) {
    const current: number[] = [i];

    for (let j = 1; j <= right.length; j++) {
      const substitutionCost =
        left[i - 1] === right[j - 1] ? 0 : 1;

      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + substitutionCost,
      );
    }

    previous = current;
  }

  return previous[right.length]!;
}

// -----------------------------------------------------------------------------
// Expected answer variants
// -----------------------------------------------------------------------------

/**
 * Allows multiple acceptable answers separated by:
 * / | ;
 *
 * Example:
 * "big / large / huge"
 */
function getExpectedVariants(expected: string): string[] {
  return [
    ...new Set(
      expected
        .split(/\s*[\/|;]\s*/)
        .map(normalizeAnswer)
        .filter(Boolean),
    ),
  ];
}

// -----------------------------------------------------------------------------
// Phrase matching
// -----------------------------------------------------------------------------

/**
 * Checks whether a spoken transcript contains the complete
 * expected expression, respecting word boundaries.
 *
 * Example:
 * Expected: "give up"
 * Transcript: "I decided to give up yesterday"
 * Result: true
 *
 * Expected: "give up"
 * Transcript: "I want to give upstairs"
 * Result: false
 */
function containsPhrase(
  transcript: string,
  expected: string,
): boolean {
  if (!transcript || !expected) return false;

  const escaped = expected.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const expression = new RegExp(
    `(?:^|\\s)${escaped}(?=$|\\s)`,
    "u",
  );

  return expression.test(transcript);
}

// -----------------------------------------------------------------------------
// Similarity
// -----------------------------------------------------------------------------

function calculateSimilarity(
  answer: string,
  expected: string,
): number {
  if (!answer || !expected) return 0;

  const distance = levenshtein(answer, expected);

  return Math.max(
    0,
    1 - distance / Math.max(answer.length, expected.length),
  );
}

/**
 * A small typo is tolerated only for a single-word answer.
 *
 * This prevents long phrases from being accepted simply because
 * their total length makes one mistake appear insignificant.
 */
function hasAcceptableTypo(
  answer: string,
  expected: string,
): boolean {
  const answerWords = answer.split(" ");
  const expectedWords = expected.split(" ");

  if (
    answerWords.length !== 1 ||
    expectedWords.length !== 1
  ) {
    return false;
  }

  if (expectedWords[0]!.length < 5) {
    return false;
  }

  return levenshtein(answer, expected) === 1;
}

// -----------------------------------------------------------------------------
// Main grading function
// -----------------------------------------------------------------------------

/**
 * Grades typed or spoken answers.
 *
 * Typed:
 * - Exact normalized match: correct.
 * - One typo in a word of at least 5 characters: correct, close.
 * - Similar but incorrect answer: close, not correct.
 *
 * Voice:
 * - Exact match: correct.
 * - Complete expected phrase inside transcript: correct.
 * - Minor typo: correct, close.
 *
 * Empty answers are always incorrect.
 */
export function gradeAnswer(
  answer: string,
  expected: string,
  mode: GradeMode = "typed",
): GradeResult {
  const normalizedAnswer = normalizeAnswer(answer);

  const variants = getExpectedVariants(expected);

  if (!normalizedAnswer || variants.length === 0) {
    return {
      correct: false,
      close: false,
      similarity: 0,
    };
  }

  let bestSimilarity = 0;
  let bestClose = false;

  for (const variant of variants) {
    // Exact match
    if (normalizedAnswer === variant) {
      return {
        correct: true,
        close: false,
        similarity: 1,
      };
    }

    // Voice transcript may contain the complete expected phrase.
    if (
      mode === "voice" &&
      containsPhrase(normalizedAnswer, variant)
    ) {
      return {
        correct: true,
        close: false,
        similarity: 1,
      };
    }

    const similarity = calculateSimilarity(
      normalizedAnswer,
      variant,
    );

    const acceptableTypo = hasAcceptableTypo(
      normalizedAnswer,
      variant,
    );

    if (acceptableTypo) {
      return {
        correct: true,
        close: true,
        similarity,
      };
    }

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestClose = similarity >= 0.7;
    }
  }

  return {
    correct: false,
    close: bestClose,
    similarity: bestSimilarity,
  };
}
