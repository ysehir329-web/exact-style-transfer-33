import type { AttendanceRow, Student } from "./store";
import { VAKITLER } from "./stats";

export type Period = "gunluk" | "haftalik" | "aylik" | "yillik" | "tumu";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "gunluk", label: "Günlük" },
  { key: "haftalik", label: "Haftalık" },
  { key: "aylik", label: "Aylık" },
  { key: "yillik", label: "Yıllık" },
  { key: "tumu", label: "Tümü" },
];

export type Range = { start: string; end: string };

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => new Date(`${s}T00:00:00Z`);

/** Date range (inclusive, YYYY-MM-DD) for a period around the reference day. Weeks run Monday–Sunday. */
export function periodRange(period: Period, ref: string, rows: AttendanceRow[] = []): Range {
  const d = parse(ref);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (period) {
    case "gunluk":
      return { start: ref, end: ref };
    case "haftalik": {
      const offset = (d.getUTCDay() + 6) % 7; // Monday = 0
      const mon = new Date(Date.UTC(y, m, d.getUTCDate() - offset));
      const sun = new Date(Date.UTC(y, m, d.getUTCDate() - offset + 6));
      return { start: toKey(mon), end: toKey(sun) };
    }
    case "aylik":
      return { start: toKey(new Date(Date.UTC(y, m, 1))), end: toKey(new Date(Date.UTC(y, m + 1, 0))) };
    case "yillik":
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    case "tumu": {
      if (!rows.length) return { start: ref, end: ref };
      const dates = rows.map((r) => r.date).sort();
      return { start: dates[0]!, end: dates[dates.length - 1]! };
    }
  }
}

export function filterRows(rows: AttendanceRow[], range: Range, studentId?: string) {
  return rows.filter((r) => r.date >= range.start && r.date <= range.end && (!studentId || r.studentId === studentId));
}

const DURUM: Record<AttendanceRow["durum"], string> = { normal: "Normal", gec: "Geç Kaldı", izinli: "İzinli" };

export type SummaryRow = {
  name: string;
  gun: number;
  kilinan: number;
  toplamVakit: number;
  namazYuzde: number;
  ders: number;
  dersYuzde: number;
  gec: number;
  izinli: number;
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function buildReport(students: Student[], rows: AttendanceRow[]) {
  const nameOf = new Map(students.map((s) => [s.id, s.name]));
  const byStudent = new Map<string, AttendanceRow[]>();
  for (const r of rows) {
    if (!nameOf.has(r.studentId)) continue;
    (byStudent.get(r.studentId) ?? byStudent.set(r.studentId, []).get(r.studentId)!).push(r);
  }

  const summary: SummaryRow[] = students
    .filter((s) => byStudent.has(s.id))
    .map((s) => {
      const list = byStudent.get(s.id)!;
      const kilinan = list.reduce((a, r) => a + r.vakitler.length, 0);
      const ders = list.filter((r) => r.ders).length;
      return {
        name: s.name,
        gun: list.length,
        kilinan,
        toplamVakit: list.length * VAKITLER.length,
        namazYuzde: pct(kilinan, list.length * VAKITLER.length),
        ders,
        dersYuzde: pct(ders, list.length),
        gec: list.filter((r) => r.durum === "gec").length,
        izinli: list.filter((r) => r.durum === "izinli").length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const detail = rows
    .filter((r) => nameOf.has(r.studentId))
    .map((r) => ({
      date: r.date,
      name: nameOf.get(r.studentId)!,
      vakitler: VAKITLER.map((v) => r.vakitler.includes(v)),
      ders: r.ders,
      durum: DURUM[r.durum],
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "tr"));

  return { summary, detail };
}

export function formatDay(s: string) {
  return parse(s).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function rangeLabel(r: Range) {
  return r.start === r.end ? formatDay(r.start) : `${formatDay(r.start)} – ${formatDay(r.end)}`;
}

/** ASCII file-name slug for Turkish names ("Ahmet Yılmaz" -> "ahmet-yilmaz"). */
export function fileSlug(s: string) {
  const map: Record<string, string> = { ı: "i", ğ: "g", ü: "u", ş: "s", ö: "o", ç: "c" };
  return (
    s.toLocaleLowerCase("tr").replace(/[ığüşöç]/g, (c) => map[c] ?? c).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "talebe"
  );
}
