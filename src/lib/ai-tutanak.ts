// Pure helpers for the "AI Tutanak" page: prompt building and parsing the AI reply.
// Kept free of server/browser APIs so they can be unit tested.

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** "2026-10-30" -> "30 Ekim 2026". Returns the input unchanged if it is not an ISO date. */
export function trDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const ay = AYLAR[Number(m[2]) - 1];
  return ay ? `${Number(m[3])} ${ay} ${m[1]}` : iso;
}

export type FullTutanakInput = {
  name: string;
  date: string;
  positive: boolean;
  category: string;
  note: string;
  group?: string | undefined;
};

export const FULL_TUTANAK_INSTRUCTIONS = `Sen bir Kur'an kursunda hocaya yardımcı olan, resmi yazışma konusunda deneyimli bir asistansın.
Hoca sana bir talebe hakkında birkaç kelimelik kısa bir not verecek. Bu notu genişleterek eksiksiz, resmi ve düzgün Türkçe bir TALEBE TUTANAĞI metnine dönüştür.

Kurallar:
- Metinde talebenin adını ve olay tarihini mutlaka açıkça yaz (ör. "30 Ekim 2026 tarihinde kursumuz talebesi Ahmet Yılmaz...").
- Olayı ayrıntılı ve anlaşılır biçimde anlat: ne oldu, nerede (kurs ortamında), olayın kursa ve diğer talebelere etkisi.
- Notta olmayan isim, saat, yaralanma, ceza, eşya gibi somut olgular UYDURMA. Notu genişletirken genel ve tarafsız ifadeler kullan.
- Olumsuz bir olaysa: olayı tarafsız anlat, talebenin uyarıldığını değil "uyarılması ve velisiyle görüşülmesi uygun görülmüştür" gibi öneri diliyle bitir.
- Olumlu bir olaysa: davranışı takdirle anlat, teşvik edici bir dille bitir.
- 3-4 paragraf yaz. Son paragraf şu kalıpla bitsin: "İşbu tutanak, olayın kayıt altına alınması amacıyla tarafımızca düzenlenmiştir."
- Saygılı, resmi ve tarafsız bir dil kullan; yazım ve noktalama kurallarına uy.
- İmza satırı, "Sayın", hitap veya başlık satırı ekleme; bunlar ayrıca eklenecek.

Yanıtı YALNIZCA şu JSON biçiminde ver, başka hiçbir şey yazma:
{"baslik": "kısa ve resmi tutanak başlığı (en fazla 8 kelime)", "kategori": "en uygun kategori", "metin": "tutanak metni, paragraflar arasında \\n\\n"}`;

export function buildFullTutanakPrompt(i: FullTutanakInput): string {
  return [
    `Talebenin adı: ${i.name.trim()}`,
    i.group?.trim() ? `Grubu: ${i.group.trim()}` : "",
    `Olay tarihi: ${trDate(i.date)}`,
    `Tür: ${i.positive ? "Olumlu" : "Olumsuz"}`,
    `Kategori: ${i.category.trim() || "Sen seç"}`,
    "",
    "Hocanın kısa notu:",
    i.note.trim(),
  ]
    .filter((l, idx) => l !== "" || idx === 5)
    .join("\n");
}

export type AiTutanak = { title: string; tag: string; body: string };

/** Parses the model's JSON reply; falls back to treating the whole reply as the body. */
export function parseAiTutanak(raw: string, fallback: { title: string; tag: string }): AiTutanak {
  const text = raw.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const j = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      const body = typeof j.metin === "string" ? j.metin.trim() : "";
      if (body) {
        return {
          title: (typeof j.baslik === "string" && j.baslik.trim()) || fallback.title,
          tag: (typeof j.kategori === "string" && j.kategori.trim()) || fallback.tag,
          body,
        };
      }
    } catch {
      /* fall through */
    }
  }
  return { title: fallback.title, tag: fallback.tag, body: text.replace(/^```\w*\n?|```$/g, "").trim() };
}
