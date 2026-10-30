import type { AttendanceRow } from "./store";

export const VAKITLER = ["Sabah", "Öğle", "İkindi", "Akşam", "Yatsı"] as const;

export function computeStats(rows: AttendanceRow[]) {
  const vakit = Object.fromEntries(VAKITLER.map((v) => [v, rows.filter((r) => r.vakitler.includes(v)).length])) as Record<string, number>;
  return {
    toplam: rows.length,
    ders: rows.filter((r) => r.ders).length,
    gec: rows.filter((r) => r.durum === "gec").length,
    izinli: rows.filter((r) => r.durum === "izinli").length,
    katilmadi: rows.filter((r) => r.durum === "normal" && !r.ders && r.vakitler.length === 0).length,
    namazGun: rows.filter((r) => r.vakitler.length > 0).length,
    vakit,
  };
}

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export function monthly(rows: AttendanceRow[]) {
  const by: Record<string, AttendanceRow[]> = {};
  for (const r of rows) (by[r.date.slice(0, 7)] ??= []).push(r);
  return Object.keys(by)
    .sort()
    .slice(-6)
    .map((k) => {
      const list = by[k]!;
      const vakitSum = list.reduce((a, r) => a + r.vakitler.length, 0);
      return {
        key: k,
        ay: AYLAR[Number(k.slice(5, 7)) - 1] ?? k,
        namaz: Math.round((vakitSum / (list.length * 5)) * 100),
        ders: Math.round((list.filter((r) => r.ders).length / list.length) * 100),
      };
    });
}
