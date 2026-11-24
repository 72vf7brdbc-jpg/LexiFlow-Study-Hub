import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { APICallError, streamText } from "ai";

import { ANALYSIS_MODEL, createPersonalProvider, friendlyAiError } from "@/lib/ai/provider.server";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function verifyUser(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return false;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return false;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await client.auth.getUser(token);
  return !error && !!data.user;
}

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyUser(request))) return json(401, { error: "Accedi per usare la risposta vocale." });

        const declared = Number(request.headers.get("content-length") ?? "0");
        if (declared > MAX_AUDIO_BYTES + 64 * 1024) return json(413, { error: "Registrazione troppo lunga." });

        let file: File | null = null;
        try {
          const form = await request.formData();
          const value = form.get("file");
          file = value instanceof File ? value : null;
        } catch {
          return json(400, { error: "Registrazione non valida." });
        }
        if (!file || file.size < 2048) return json(400, { error: "La registrazione è vuota: riprova parlando più vicino al microfono." });
        if (file.size > MAX_AUDIO_BYTES) return json(413, { error: "Registrazione troppo lunga." });
        if (!file.type.startsWith("audio/")) return json(400, { error: "Formato audio non supportato." });

        const apiKey = process.env["GOOGLE_API_KEY"];
        if (!apiKey) return json(503, { error: "Trascrizione Gemini personale non configurata. Usa la tastiera o la dettatura del telefono." });

        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const provider = createPersonalProvider(apiKey);
          const result = streamText({
            model: provider(ANALYSIS_MODEL),
            system: "Transcribe the spoken English word, phrase, or short sentence accurately. Return only the spoken text, with no commentary or quotes.",
            messages: [{ role: "user", content: [{ type: "file", data: bytes, mediaType: file.type || "audio/wav" }] }],
            maxRetries: 0,
            abortSignal: request.signal,
          });
          const text = (await result.text).trim();
          const payload = `data: ${JSON.stringify({ type: "transcript.text.done", text })}\n\ndata: [DONE]\n\n`;
          return new Response(payload, {
            status: 200,
            headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform" },
          });
        } catch (error) {
          const api = APICallError.isInstance(error) ? error : APICallError.isInstance((error as { cause?: unknown })?.cause) ? (error as { cause: APICallError }).cause : null;
          if (api) {
            console.error("transcription failed", api.statusCode, api.responseBody?.slice(0, 300));
            return json(api.statusCode ?? 502, { error: friendlyAiError(api.statusCode, "Non è stato possibile trascrivere l'audio.") });
          }
          console.error("transcription failed", error);
          return json(500, { error: "Non è stato possibile trascrivere l'audio." });
        }
      },
    },
  },
});
