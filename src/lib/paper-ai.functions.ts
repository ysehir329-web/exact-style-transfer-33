import { createServerFn } from "@tanstack/react-start";
import { VAKITLER } from "./stats";

export type PaperRow = { studentId: string; date: string; vakitler: string[]; ders: boolean };

const MAX_IMAGES = 6;
const MAX_IMAGE_CHARS = 4_000_000;

const INSTRUCTIONS = `Kur'an kursunun kâğıda alınmış yoklama çizelgesinin fotoğraflarını okuyorsun.
Görevin: her talebe ve her gün için hangi namaz vakitlerine (${VAKITLER.join(", ")}) ve derse katıldığını çıkarmak.
Kurallar:
- Sadece verilen talebe listesindeki isimlerle eşleştir; eşleşmeyen isimleri atla. Yazım farklarını (kısaltma, harf hatası) makul ölçüde eşleştir.
- Sadece verilen tarih aralığındaki günleri yaz. Tarihleri YYYY-MM-DD biçiminde ver.
- İşaret (✓, X, +, nokta, imza) katıldı demektir; boş hücre katılmadı demektir. Emin olmadığın hücreyi boş say.
- Çizelgede olmayan günü uydurma.
- YALNIZCA şu JSON'u döndür, başka hiçbir şey yazma:
{"rows":[{"studentId":"...","date":"YYYY-MM-DD","vakitler":["Sabah"],"ders":true}]}`;

const isoRe = /^\d{4}-\d{2}-\d{2}$/;

export const analyzePaperAttendance = createServerFn({ method: "POST" })
  .inputValidator((input: { images: string[]; students: { id: string; name: string }[]; start: string; end: string }) => {
    const images = Array.isArray(input?.images) ? input.images.map(String) : [];
    if (!images.length) throw new Error("Önce fotoğraf seçin.");
    if (images.length > MAX_IMAGES) throw new Error(`En fazla ${MAX_IMAGES} fotoğraf yükleyebilirsiniz.`);
    if (images.some((i) => !i.startsWith("data:image/") || i.length > MAX_IMAGE_CHARS)) throw new Error("Fotoğraf okunamadı.");
    const students = (input?.students ?? []).slice(0, 300).map((s) => ({ id: String(s.id), name: String(s.name).slice(0, 100) }));
    if (!students.length) throw new Error("Önce talebe ekleyin.");
    const start = String(input?.start ?? "");
    const end = String(input?.end ?? "");
    if (!isoRe.test(start) || !isoRe.test(end) || start > end) throw new Error("Tarih aralığı geçersiz.");
    return { images, students, start, end };
  })
  .handler(async ({ data }) => {
    const { generateWithImagesViaGateway, aiErrorMessage } = await import("./ai-gateway.server");
    const prompt = `Tarih aralığı: ${data.start} – ${data.end}\nTalebeler (id: isim):\n${data.students.map((s) => `${s.id}: ${s.name}`).join("\n")}`;
    try {
      const text = await generateWithImagesViaGateway(INSTRUCTIONS, prompt, data.images);
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const parsed = JSON.parse(json) as { rows?: unknown[] };
      const ids = new Set(data.students.map((s) => s.id));
      const vk = new Set<string>(VAKITLER);
      const rows: PaperRow[] = [];
      const seen = new Set<string>();
      for (const r of parsed.rows ?? []) {
        const o = r as Record<string, unknown>;
        const studentId = String(o["studentId"] ?? "");
        const date = String(o["date"] ?? "");
        if (!ids.has(studentId) || !isoRe.test(date) || date < data.start || date > data.end) continue;
        const key = `${studentId}|${date}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const vakitler = Array.isArray(o["vakitler"]) ? o["vakitler"].map(String).filter((v) => vk.has(v)) : [];
        rows.push({ studentId, date, vakitler: VAKITLER.filter((v) => vakitler.includes(v)), ders: Boolean(o["ders"]) });
      }
      rows.sort((a, b) => a.date.localeCompare(b.date));
      return { ok: true as const, rows };
    } catch (error) {
      console.error("analyzePaperAttendance failed", error);
      return { ok: false as const, error: error instanceof SyntaxError ? "Fotoğraf okunamadı, daha net bir fotoğraf deneyin." : aiErrorMessage(error) };
    }
  });
