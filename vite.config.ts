// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { readFileSync } from "node:fs";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Every per-icon file re-exported by src/components/app/icons.ts, so they are pre-bundled at
// startup instead of being discovered (and re-optimized) while a tab is open.
const iconDeps = [
  ...readFileSync(new URL("./src/components/app/icons.ts", import.meta.url), "utf8").matchAll(
    /from "(lucide-react\/dist\/esm\/icons\/[^"]+)"/g,
  ),
].map((m) => m[1] as string);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Pre-bundle lazily imported deps at startup. Otherwise Vite discovers them on first
    // use, re-optimizes, and already-open tabs fail lazy route imports
    // ("Importing a module script failed").
    optimizeDeps: {
      include: [...iconDeps, "jspdf", "jspdf-autotable", "pdf-lib", "xlsx", "clsx", "tailwind-merge"],
    },
  },
});
