import { createServerFn } from "@tanstack/react-start";

const MAX_LEN = 4000;

const INSTRUCTIONS = `Sen bir Kur'an kursunda hocaya yardımcı olan bir asistansın.
Hocanın aceleyle yazdığı ham notları resmi, düzgün Türkçe bir tutanak metnine dönüştür.
Kurallar:
- Sadece notlarda geçen bilgileri kullan; yeni olay, isim, saat veya ayrıntı uydurma.
- Yazım ve noktalama hatalarını düzelt, cümleleri toparla, saygılı ve tarafsız bir dil kullan.
- Kısa tut (1-3 paragraf). Başlık, tarih veya imza satırı ekleme.
- Yalnızca tutanak metnini döndür, açıklama yapma.`;

export const polishTutanak = createServerFn({ method: "POST" })
  .inputValidator((input: { text: string; category: string; positive: boolean }) => {
    const text = String(input?.text ?? "").trim();
    if (!text) throw new Error("Önce tutanak metnini yazın.");
    if (text.length > MAX_LEN) throw new Error(`Metin en fazla ${MAX_LEN} karakter olabilir.`);
    return { text, category: String(input?.category ?? "").slice(0, 80), positive: Boolean(input?.positive) };
  })
  .handler(async ({ data }) => {
    const { generateTextViaGateway, aiErrorMessage } = await import("./ai-gateway.server");
    const prompt = `Tür: ${data.positive ? "Olumlu" : "Olumsuz"}\nKategori: ${data.category}\n\nHam notlar:\n${data.text}`;
    try {
      return { ok: true as const, text: await generateTextViaGateway(INSTRUCTIONS, prompt) };
    } catch (error) {
      console.error("polishTutanak failed", error);
      return { ok: false as const, error: aiErrorMessage(error) };
    }
  });

/** Expands a short note into a complete, formal tutanak that names the child and the date. */
export const writeFullTutanak = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; date: string; positive: boolean; category: string; note: string; group?: string }) => {
    const note = String(input?.note ?? "").trim();
    const name = String(input?.name ?? "").trim();
    if (!name) throw new Error("Önce talebeyi seçin.");
    if (!note) throw new Error("Önce kısa notu yazın.");
    if (note.length > MAX_LEN) throw new Error(`Not en fazla ${MAX_LEN} karakter olabilir.`);
    return {
      name: name.slice(0, 120),
      date: String(input?.date ?? "").slice(0, 10),
      positive: Boolean(input?.positive),
      category: String(input?.category ?? "").slice(0, 80),
      note,
      group: String(input?.group ?? "").slice(0, 80),
    };
  })
  .handler(async ({ data }) => {
    const { generateTextViaGateway, aiErrorMessage } = await import("./ai-gateway.server");
    const { FULL_TUTANAK_INSTRUCTIONS, buildFullTutanakPrompt, parseAiTutanak } = await import("./ai-tutanak");
    try {
      const raw = await generateTextViaGateway(FULL_TUTANAK_INSTRUCTIONS, buildFullTutanakPrompt(data));
      const fallbackTag = data.category || (data.positive ? "Güzel Davranış" : "Diğer");
      return { ok: true as const, ...parseAiTutanak(raw, { title: fallbackTag, tag: fallbackTag }) };
    } catch (error) {
      console.error("writeFullTutanak failed", error);
      return { ok: false as const, error: aiErrorMessage(error) };
    }
  });
