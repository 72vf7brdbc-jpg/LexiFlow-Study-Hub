import { createOpenAI } from "@ai-sdk/openai";

export const ANALYSIS_MODEL = "gpt-4.1-mini";
export const COACH_MODEL = "gpt-4.1-mini";
export const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
export const PROVIDER_URL = "https://api.openai.com";
export const AI_SETUP_MESSAGE = "L’AI personale non è configurata. Puoi continuare a studiare e inserire contenuti manualmente; per analisi e chiarimenti occorre collegare una chiave OpenAI personale.";

export function getPersonalApiKey(): string {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new Error(AI_SETUP_MESSAGE);
  return key;
}

export function createResponsesProvider(apiKey: string) {
  return createOpenAI({ baseURL: `${PROVIDER_URL}/v1`, apiKey });
}

export function friendlyAiError(status: number | undefined, fallback?: string): string {
  if (status === 401) return "La chiave OpenAI personale non è valida: controlla la configurazione.";
  if (status === 402) return "Il servizio AI personale richiede credito sul tuo account OpenAI, non crediti Lovable.";
  if (status === 403) return fallback || "Il servizio AI personale ha negato l’accesso. La richiesta è stata interrotta.";
  if (status === 429) return "Il tuo account OpenAI ha raggiunto un limite di utilizzo o richieste. Controlla il piano e riprova solo quando il limite è risolto.";
  if (status === 404) return "Il modello AI personale non è disponibile. La richiesta è stata interrotta.";
  if (status === 400) return "Il servizio AI personale non ha accettato il contenuto della richiesta.";
  if (status && status >= 500) return "Il servizio AI personale è momentaneamente non disponibile.";
  return fallback || "Non è stato possibile completare la richiesta AI personale.";
}