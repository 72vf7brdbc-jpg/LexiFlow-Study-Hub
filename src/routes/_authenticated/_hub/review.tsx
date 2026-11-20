import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import ReviewSection from "@/components/lexi/ReviewSection";
import { InlineError, LoadingScreen } from "@/components/lexi/ui-bits";
import { isMethodId, type MethodId } from "@/lib/methods";
import { reviewDataQuery } from "@/lib/queries";
import { grammarQuery } from "@/lib/grammar-queries";

type ReviewSearch = { method?: MethodId | undefined; mode?: "practice" | undefined; material?: string | undefined };
export const Route = createFileRoute("/_authenticated/_hub/review")({
  validateSearch: (s: Record<string, unknown>): ReviewSearch => ({
    method: isMethodId(s["method"]) ? s["method"] : s["mode"] === "practice" ? "active_recall" : undefined,
    mode: s["mode"] === "practice" ? "practice" : undefined,
    material: typeof s["material"] === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s["material"]) ? s["material"] : undefined,
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(reviewDataQuery), context.queryClient.ensureQueryData(grammarQuery)]),
  head: () => ({ meta: [
    { title: "Ripasso — LexiFlow Study Hub" },
    { name: "description", content: "Ripassa la grammatica con teoria ed esercizi dedicati, insieme ai dieci metodi sulle parole delle tue lezioni." },
    { property: "og:title", content: "Ripasso — LexiFlow Study Hub" },
    { property: "og:description", content: "Il quaderno di grammatica, i tuoi vocaboli e gli esercizi con correzione AI." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  pendingComponent: () => <LoadingScreen label="Preparo il Ripasso…" />,
  errorComponent: ({ error, reset }) => <InlineError message={error instanceof Error ? error.message : undefined} onRetry={reset} />,
  component: ReviewPage,
});
function ReviewPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(reviewDataQuery);
  return <ReviewSection data={data} method={search.method} material={search.material} onSelect={(method) => { void navigate({ to: "/review", search: { material: search.material, method } }); }} onClearMaterial={() => { void navigate({ to: "/review", search: { method: search.method } }); }} />;
}
