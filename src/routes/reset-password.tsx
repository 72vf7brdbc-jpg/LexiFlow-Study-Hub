import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/lexi/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nuova password — LexiFlow Study Hub" },
      { name: "description", content: "Scegli una nuova password per il tuo account LexiFlow." },
      { property: "og:title", content: "Nuova password — LexiFlow" },
      { property: "og:description", content: "Reimposta la password del tuo account LexiFlow Study Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    supabase.auth.getSession().then(({ data }) => setReady(isRecovery || !!data.session));
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("La password deve avere almeno 8 caratteri.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    toast.success("Password aggiornata");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col px-5 py-6 sm:px-10">
      <Logo />
      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center">
        <p className="eyebrow mb-2">Recupero account</p>
        <h1 className="text-[2.2rem] font-medium leading-tight">Scegli una nuova password</h1>
        {!ready ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Apri questa pagina dal link ricevuto via email.{" "}
            <Link to="/auth" className="font-semibold text-primary hover:underline">Torna all'accesso</Link>
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-7 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="new-password">Nuova password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl bg-paper"
              />
            </div>
            {error && <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-burgundy">{error}</p>}
            <Button type="submit" size="lg" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Salva password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
