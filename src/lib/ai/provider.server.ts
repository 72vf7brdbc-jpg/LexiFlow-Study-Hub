import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const ANALYSIS_MODEL = "gemini-2.5-flash";
export const COACH_MODEL = "gemini-2.5-flash";
export const AI_SETUP_MESSAGE = "Gemini personale non è configurato. Puoi continuare a studiare e inserire contenuti manualmente; per analisi e chiarimenti occorre collegare una chiave Gemini personale.";

export function getPersonalApiKey(): string {
  const key = process.env["GOOGLE_API_KEY"];
  if (!key) throw new Error(AI_SETUP_MESSAGE);
  return key;
}

export function createPersonalProvider(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey });
}

export function friendlyAiError(status: number | undefined, fallback?: string): string {
  if (status === 401) return "La chiave Gemini personale non è valida: controlla la configurazione.";
  if (status === 402) return "Il servizio AI personale richiede credito sul tuo account Google, non crediti Lovable.";
  if (status === 403) return fallback || "Il servizio AI personale ha negato l’accesso. La richiesta è stata interrotta.";
  if (status === 429) return "Il tuo account Gemini ha raggiunto un limite di utilizzo o richieste. Controlla il piano e riprova quando il limite è risolto.";
  if (status === 404) return "Il modello AI personale non è disponibile. La richiesta è stata interrotta.";
  if (status === 400) return "Il servizio AI personale non ha accettato il contenuto della richiesta.";
  if (status && status >= 500) return "Il servizio AI personale è momentaneamente non disponibile.";
  return fallback || "Non è stato possibile completare la richiesta AI personale.";
}