// Server-only helpers for Lovable AI Gateway (never import from browser code).
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";
const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

function runIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get(RUN_ID_HEADER)?.trim() || undefined;
    return res;
  };
}

/** One-shot text generation. Streams from the gateway, returns the final text. */
export async function generateTextViaGateway(instructions: string, prompt: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI yapılandırılmamış.");
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch(),
  });
  let failure: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages: [{ role: "user", content: prompt }],
    onError: ({ error }) => {
      failure = error;
    },
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const text = (await result.text).trim();
  if (!text) throw failure ?? new Error("AI boş yanıt döndürdü.");
  return text;
}

/** Text generation with images (data URLs). Returns the final text. */
export async function generateWithImagesViaGateway(instructions: string, prompt: string, images: string[]): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI yapılandırılmamış.");
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch(),
  });
  let failure: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }, ...images.map((image) => ({ type: "image" as const, image }))],
      },
    ],
    onError: ({ error }) => {
      failure = error;
    },
    providerOptions: { openai: { store: false, reasoningEffort: "medium" } },
  });
  const text = (await result.text).trim();
  if (!text) throw failure ?? new Error("AI boş yanıt döndürdü.");
  return text;
}

export function aiErrorMessage(error: unknown): string {
  const e = error as { statusCode?: number; status?: number; message?: string };
  const status = e?.statusCode ?? e?.status;
  if (status === 429) return "Çok fazla istek yapıldı, biraz sonra tekrar deneyin.";
  if (status === 402) return "AI kullanım hakkı doldu. Kredi eklendikten sonra tekrar deneyin.";
  if (status === 403) return "AI şu anda bu proje için kullanılamıyor.";
  return "AI ile düzenleme yapılamadı. Lütfen tekrar deneyin.";
}
