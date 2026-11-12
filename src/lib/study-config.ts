// Shared profile options and labels used by onboarding, settings and the AI prompt.

export const CEFR_LEVELS = [
  { id: "A1", name: "Principiante", blurb: "Capisci e usi espressioni quotidiane molto semplici." },
  { id: "A2", name: "Elementare", blurb: "Comunichi in situazioni di routine e scambi brevi." },
  { id: "B1", name: "Intermedio", blurb: "Te la cavi in viaggio, al lavoro e su temi familiari." },
  { id: "B2", name: "Intermedio superiore", blurb: "Interagisci con scioltezza e argomenti più complessi." },
] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number]["id"];

export const STUDY_GOALS = [
  { id: "cambridge", name: "Cambridge (FCE/CAE)", blurb: "Use of English, collocazioni e phrasal verbs d'esame." },
  { id: "ielts", name: "IELTS", blurb: "Lessico accademico per Writing, Reading e Speaking." },
  { id: "toefl", name: "TOEFL", blurb: "Inglese universitario e vocabolario delle lezioni." },
  { id: "conversation", name: "Conversazione / Business", blurb: "Espressioni naturali per la vita reale e il lavoro." },
] as const;
export type StudyGoal = (typeof STUDY_GOALS)[number]["id"];

export const NATIVE_LANGUAGES = [
  { id: "it", name: "Italiano", flag: "🇮🇹" },
  { id: "es", name: "Español", flag: "🇪🇸" },
  { id: "fr", name: "Français", flag: "🇫🇷" },
  { id: "de", name: "Deutsch", flag: "🇩🇪" },
  { id: "pt", name: "Português", flag: "🇵🇹" },
  { id: "ro", name: "Română", flag: "🇷🇴" },
  { id: "pl", name: "Polski", flag: "🇵🇱" },
  { id: "uk", name: "Українська", flag: "🇺🇦" },
  { id: "ar", name: "العربية", flag: "🇸🇦" },
  { id: "zh", name: "中文", flag: "🇨🇳" },
] as const;

export function languageName(id: string | null | undefined): string {
  return NATIVE_LANGUAGES.find((l) => l.id === id)?.name ?? "Italiano";
}

export function goalName(id: string | null | undefined): string {
  return STUDY_GOALS.find((g) => g.id === id)?.name ?? "Inglese generale";
}

export function levelName(id: string | null | undefined): string {
  return CEFR_LEVELS.find((l) => l.id === id)?.name ?? "";
}
