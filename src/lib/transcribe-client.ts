import { createParser } from "eventsource-parser";

import { supabase } from "@/integrations/supabase/client";

/** Uploads a recorded clip and returns the final transcript. */
export async function transcribeRecording(file: File, signal?: AbortSignal): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Accedi di nuovo per usare la risposta vocale.");

  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Non è stato possibile trascrivere l'audio.");
  }
  if (!res.body) throw new Error("Nessuna risposta dal servizio vocale.");

  let text = "";
  let finalText: string | null = null;
  let streamError: string | null = null;
  const parser = createParser({
    onEvent(event) {
      if (!event.data || event.data === "[DONE]") return;
      try {
        const payload = JSON.parse(event.data) as { type?: string; delta?: string; text?: string; error?: { message?: string } };
        if (payload.type === "transcript.text.delta" && payload.delta) text += payload.delta;
        else if (payload.type === "transcript.text.done" && typeof payload.text === "string") finalText = payload.text;
        else if (payload.error) streamError = payload.error.message ?? "Errore di trascrizione";
      } catch {
        /* ignore keep-alive frames */
      }
    },
  });

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    parser.feed(value);
  }
  if (streamError) throw new Error(streamError);
  const out = (finalText ?? text).trim();
  if (!out) throw new Error("Non ho sentito nulla: riprova parlando più chiaramente.");
  return out;
}
