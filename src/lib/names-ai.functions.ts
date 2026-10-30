import { createServerFn } from "@tanstack/react-start";

const MAX_IMAGES = 6;
const MAX_IMAGE_CHARS = 4_000_000;

const INSTRUCTIONS = `Fotoğraflarda bir talebe/öğrenci listesi var (el yazısı, çizelge, liste veya ekran görüntüsü olabilir).
Görevin: fotoğraflardaki kişi adlarını ve soyadlarını çıkarmak.
Kurallar:
- Sadece kişi isimlerini al; başlık, tarih, sütun adı, numara gibi şeyleri alma.
- Türkçe harfleri doğru yaz (ç, ğ, ı, İ, ö, ş, ü). Her kelimenin ilk harfi büyük olsun.
- Aynı ismi bir kez yaz. Okunamayan ismi uydurma.
- YALNIZCA şu JSON'u döndür: {"names":["Ahmet Yılmaz"]}`;

export const extractStudentNames = createServerFn({ method: "POST" })
  .inputValidator((input: { images: string[] }) => {
    const images = Array.isArray(input?.images) ? input.images.map(String) : [];
    if (!images.length) throw new Error("Önce fotoğraf seçin.");
    if (images.length > MAX_IMAGES) throw new Error(`En fazla ${MAX_IMAGES} fotoğraf yükleyebilirsiniz.`);
    if (images.some((i) => !i.startsWith("data:image/") || i.length > MAX_IMAGE_CHARS)) throw new Error("Fotoğraf okunamadı.");
    return { images };
  })
  .handler(async ({ data }) => {
    const { generateWithImagesViaGateway, aiErrorMessage } = await import("./ai-gateway.server");
    try {
      const text = await generateWithImagesViaGateway(INSTRUCTIONS, "Bu fotoğraflardaki talebe isimlerini çıkar.", data.images);
      const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { names?: unknown[] };
      const seen = new Set<string>();
      const names: string[] = [];
      for (const n of parsed.names ?? []) {
        const name = String(n).replace(/\s+/g, " ").trim().slice(0, 100);
        const key = name.toLocaleLowerCase("tr");
        if (name && !seen.has(key)) { seen.add(key); names.push(name); }
      }
      return { ok: true as const, names: names.slice(0, 300) };
    } catch (error) {
      console.error("extractStudentNames failed", error);
      return { ok: false as const, error: error instanceof SyntaxError ? "İsimler okunamadı, daha net bir fotoğraf deneyin." : aiErrorMessage(error) };
    }
  });
