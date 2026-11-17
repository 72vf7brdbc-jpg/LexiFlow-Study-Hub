// Server-only Lovable AI Gateway helpers.
import { createOpenAI } from "@ai-sdk/openai";

export const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev";
export const ANALYSIS_MODEL = "openai/gpt-6-astra";
export const COACH_MODEL = "openai/gpt-6-astra";
export const TRANSCRIBE_MODEL = "openai/gpt-transcribe";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    getRunId: () => runId,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      const response = await fetch(input, { ...init, headers });
      runId ??= response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
      return response;
    },
  };
}

export function getLovableApiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

/** Request-scoped Responses provider. */
export function createResponsesProvider(apiKey: string) {
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  return createOpenAI({
    baseURL: `${AI_GATEWAY_URL}/v1`,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
}

/** Plain-language message for a gateway failure status. */
export function friendlyAiError(status: number | undefined, fallback?: string): string {
  if (status === 402) return "I crediti AI dell'area di lavoro sono esauriti. Aggiungi crediti per continuare ad analizzare materiali.";
  if (status === 403) return fallback || "L'analisi AI non è disponibile per questo account al momento.";
  if (status === 429) return "Troppe richieste in poco tempo. Attendi qualche secondo e riprova.";
  if (status === 400) return "Il contenuto non è stato accettato dall'AI. Prova con una foto più nitida o un file diverso.";
  if (status && status >= 500) return "Il servizio AI è momentaneamente non disponibile. Riprova tra poco.";
  return fallback || "Non è stato possibile analizzare il materiale. Riprova.";
}
