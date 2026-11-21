<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Study rules (spaced repetition, streak, XP, session size, answer grading) live as pure functions in `src/lib/{srs,streak,plan,grading}.ts` and are covered by `src/test/study-rules.test.ts`; change them there, never inline in components or server functions.
- AI work runs only in `src/lib/ai/*.server.ts`, behind authenticated material, coach and grammar server functions; voice transcription uses `/api/transcribe` with bearer verification, keeping credentials and evaluations server-side.
- Signed-in pages live under `src/routes/_authenticated/_hub/` so the hub layout can redirect un-onboarded users to `/onboarding` before rendering.

- ReviewSection dispatches to dedicated method sessions in `src/components/lexi/review/`; method eligibility and exercise builders stay in pure library modules so one generic drill cannot replace distinct methods.
- Grammar uses separate user-owned rules and attempts, with validated structured theory/exercises; extraction shares the upload AI call and requires a literal source quote so lesson attribution is evidenced, while manual requests stay explicitly separate.
- Grammar teaching is an optional validated extension of existing content, upgraded only on user action without replacing exercises or lesson evidence; personal clarifications are owner-scoped rows tied to the rule so they survive reloads.
- Persist terminal grammar AI access denials in user-scoped storage before allowing further clarification or theory-upgrade calls, avoiding repeated denied requests across reloads.
