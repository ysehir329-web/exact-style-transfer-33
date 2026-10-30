import { describe, expect, it } from "vitest";
import { computeStats, monthly } from "./stats";

const rows = [
  { id: "1", studentId: "s", date: "2026-10-21", vakitler: [], ders: false, durum: "izinli" as const },
  { id: "2", studentId: "s", date: "2026-10-22", vakitler: ["Sabah", "Öğle", "İkindi", "Akşam", "Yatsı"], ders: true, durum: "normal" as const },
  { id: "3", studentId: "s", date: "2026-10-23", vakitler: ["Akşam"], ders: false, durum: "gec" as const },
];

describe("stats", () => {
  it("counts days by type", () => {
    const s = computeStats(rows);
    expect([s.toplam, s.ders, s.gec, s.izinli, s.vakit["Akşam"]]).toEqual([3, 1, 1, 1, 2]);
  });
  it("monthly percentages", () => {
    expect(monthly(rows)[0]).toMatchObject({ namaz: 40, ders: 33 });
  });
});
