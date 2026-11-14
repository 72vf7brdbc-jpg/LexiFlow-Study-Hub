import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import "@lovable.dev/cloud-auth-js/styles.css";

import { Logo } from "@/components/lexi/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

type AuthSearch = { redirect?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Accedi — LexiFlow Study Hub" },
      { name: "description", content: "Accedi o crea il tuo account LexiFlow per trasformare le lezioni in schede di studio." },
      { property: "og:title", content: "Accedi a LexiFlow Study Hub" },
      { property: "og:description", content: "Il tuo spazio di studio per l'inglese, con schede AI e ripetizione spaziata." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const RETURN_KEY = "lexiflow:return-to";

function safePath(value: string | undefined | null): string {
  if (!value) return "/dashboard";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "/dashboard";
    const path = url.pathname + url.search;
    if (path.startsWith("/auth") || path === "/") return "/dashboard";
    return path;
  } catch {
    return "/dashboard";
  }
}

const credentialsSchema = z.object({
  email: z.string().trim().email("Inserisci un'email valida").max(255),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri").max(72),
});

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "email" | "google" | "lovable">(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | "confirm" | "reset">(null);

  const goNext = () => {
    const stored = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    navigate({ to: safePath(search["redirect"] ?? stored), replace: true });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goNext();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) goNext();
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "forgot") {
      const parsed = z.string().trim().email().safeParse(email);
      if (!parsed.success) return setError("Inserisci un'email valida");
      setBusy("email");
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(null);
      if (error) return setError(error.message);
      setSent("reset");
      return;
    }
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Dati non validi");
    setBusy("email");
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { emailRedirectTo: window.location.origin + "/dashboard" },
      });
      setBusy(null);
      if (error) return setError(translateAuthError(error.message));
      if (!data.session) setSent("confirm");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(null);
    if (error) return setError(translateAuthError(error.message));
  }

  async function social(provider: "google" | "lovable") {
    setError(null);
    setBusy(provider);
    sessionStorage.setItem(RETURN_KEY, safePath(search.redirect));
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (result.error) {
      setBusy(null);
      toast.error("Accesso non riuscito. Riprova.");
      return;
    }
    if (result.redirected) return;
    setBusy(null);
    goNext();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft /> Home
            </Link>
          </Button>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          {sent ? (
            <div className="animate-rise text-center">
              <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full border border-border bg-paper text-primary">
                <MailCheck className="size-6" />
              </div>
              <h1 className="text-3xl font-medium">Controlla la tua email</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {sent === "confirm"
                  ? `Abbiamo inviato un link di conferma a ${email}. Aprilo per attivare l'account.`
                  : `Se esiste un account per ${email}, riceverai un link per reimpostare la password.`}
              </p>
              <Button variant="outline" className="mt-6" onClick={() => { setSent(null); setMode("signin"); }}>
                Torna all'accesso
              </Button>
            </div>
          ) : (
            <div className="animate-rise">
              <p className="eyebrow mb-2">
                {mode === "signup" ? "Nuovo account" : mode === "forgot" ? "Recupero" : "Bentornato"}
              </p>
              <h1 className="text-[2.2rem] font-medium leading-tight">
                {mode === "signup" ? "Crea il tuo studio" : mode === "forgot" ? "Reimposta la password" : "Accedi a LexiFlow"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "forgot"
                  ? "Ti invieremo un link per scegliere una nuova password."
                  : "Le tue lezioni, schede e progressi ti aspettano."}
              </p>

              {mode !== "forgot" && (
                <div className="mt-7 grid gap-2.5">
                  <button
                    type="button"
                    onClick={() => social("google")}
                    disabled={busy !== null}
                    className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-[#747775] bg-[#FFFFFF] px-3 text-[14px] font-medium leading-5 text-[#1F1F1F] transition-shadow hover:shadow-soft disabled:opacity-60"
                  >
                    {busy === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
                    Continua con Google
                  </button>
                  <button
                    type="button"
                    className="lovable-auth-button !h-11 !w-full !rounded-full"
                    onClick={() => social("lovable")}
                    disabled={busy !== null}
                  >
                    Continua con Lovable
                  </button>
                </div>
              )}

              {mode !== "forgot" && (
                <div className="my-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="eyebrow">oppure con email</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}

              <form onSubmit={onSubmit} className={mode === "forgot" ? "mt-7 grid gap-4" : "grid gap-4"} noValidate>
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@esempio.it"
                    className="h-11 rounded-xl bg-paper"
                    required
                  />
                </div>
                {mode !== "forgot" && (
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {mode === "signin" && (
                        <button type="button" onClick={() => { setMode("forgot"); setError(null); }} className="text-xs font-medium text-primary hover:underline">
                          Password dimenticata?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Almeno 8 caratteri"
                      className="h-11 rounded-xl bg-paper"
                      required
                    />
                  </div>
                )}
                {error && (
                  <p role="alert" className="rounded-xl border border-burgundy/25 bg-danger-soft px-3.5 py-2.5 text-sm text-burgundy">
                    {error}
                  </p>
                )}
                <Button type="submit" size="lg" disabled={busy !== null} className="mt-1 w-full">
                  {busy === "email" && <Loader2 className="animate-spin" />}
                  {mode === "signup" ? "Crea account" : mode === "forgot" ? "Invia link" : "Accedi"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signup" ? "Hai già un account?" : mode === "forgot" ? "Ricordi la password?" : "Non hai un account?"}{" "}
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline"
                  onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
                >
                  {mode === "signin" ? "Registrati" : "Accedi"}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="relative hidden overflow-hidden border-l border-border bg-paper lg:block">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full border border-border" />
        <div className="pointer-events-none absolute -right-12 -top-12 size-64 rounded-full border border-border" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full border border-border" />
        <div className="relative flex h-full flex-col items-center justify-center px-12">
          <p className="eyebrow">Parola del giorno</p>
          <p className="mt-4 font-display text-6xl italic leading-none text-primary">serendipity</p>
          <p className="mt-3 text-sm text-muted-foreground">/ˌserənˈdɪpəti/ · scoperta felice e inattesa</p>
          <blockquote className="paper mt-12 max-w-md p-6 shadow-lift">
            <p className="font-display text-xl italic leading-snug">
              “Repetition is the mother of learning — but timing is its father.”
            </p>
            <footer className="eyebrow mt-3">Il principio della ripetizione spaziata</footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Email o password non corrette.";
  if (m.includes("email not confirmed")) return "Conferma prima la tua email: controlla la casella di posta.";
  if (m.includes("already registered")) return "Esiste già un account con questa email. Prova ad accedere.";
  if (m.includes("password")) return "La password non soddisfa i requisiti di sicurezza. Scegline una più forte.";
  if (m.includes("rate")) return "Troppi tentativi. Attendi qualche minuto e riprova.";
  return msg;
}
