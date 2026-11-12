import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { AI_GATEWAY_URL, TRANSCRIBE_MODEL, friendlyAiError } from "@/lib/ai/gateway.server";

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

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return json(500, { error: "Servizio vocale non configurato." });

        const upstream = new FormData();
        upstream.append("model", TRANSCRIBE_MODEL);
        upstream.append("file", file, file.name || "recording.wav");
        upstream.append("response_format", "json");
        upstream.append("stream", "true");
        upstream.append("prompt", "A language learner says an English word, phrase or short sentence for a vocabulary exercise.");

        const res = await fetch(`${AI_GATEWAY_URL}/v1/audio/transcriptions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
          body: upstream,
          signal: request.signal,
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          console.error("transcription failed", res.status, detail.slice(0, 300));
          return json(res.status, { error: friendlyAiError(res.status, "Non è stato possibile trascrivere l'audio.") });
        }

        return new Response(res.body, {
          status: res.status,
          headers: {
            "content-type": res.headers.get("content-type") ?? "text/event-stream",
            "cache-control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});
