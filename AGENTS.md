<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Attendance report export (PDF via jspdf, Excel via xlsx-js-style because plain SheetJS cannot write borders/rotated text for the namaz takip çizelgesi) lives in `src/lib/report-export.ts` and loads those libraries with dynamic `import()` so they never slow app startup; period/summary logic stays pure in `src/lib/report.ts` with tests.
- PDFs embed the subset DejaVu fonts in `public/fonts/` because jsPDF's built-in fonts cannot render Turkish letters (ğ, ş, ı, İ).
- App data lives in browser localStorage via `src/lib/store.tsx`; there is no backend.
- Lazily imported npm deps must be listed in `optimizeDeps.include` in `vite.config.ts`, because runtime re-optimization breaks lazy route imports in open tabs; `src/lib/chunk-reload.ts` reloads once on any chunk-load failure as a safety net.
- App code imports icons only from `src/components/app/icons.ts` (per-icon lucide files), never the `lucide-react` barrel, because the barrel is a multi-MB file in the dev preview that made phones slow to open; `vite.config.ts` pre-bundles the icons listed there automatically.
- The app shell (header + bottom tab bar) is rendered once in `src/routes/__root.tsx` around `<Outlet />`; pages must not wrap themselves in `AppShell`, because remounting it per page made tab switches slow and reset the tab highlight.
- AI features call the Lovable AI Gateway only from server functions in `src/lib/*-ai.functions.ts` via `src/lib/ai-gateway.server.ts`; prompt building and reply parsing stay pure (e.g. `src/lib/ai-tutanak.ts`) with tests, so the server-only key never reaches the browser.
