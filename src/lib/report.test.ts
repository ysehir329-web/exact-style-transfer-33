import { describe, expect, it } from "vitest";
import { buildChart, chartByMonth, buildReport, fileSlug, filterRows, periodRange } from "./report";
import type { AttendanceRow, Student } from "./store";

const row = (id: string, date: string, vakitler: string[], ders = false, durum: AttendanceRow["durum"] = "normal"): AttendanceRow => ({ id, studentId: "s1", date, vakitler, ders, durum });
const rows = [
  row("1", "2026-01-15", ["Sabah"]),
  row("2", "2026-10-26", ["Sabah", "Öğle", "İkindi", "Akşam", "Yatsı"], true),
  row("3", "2026-10-28", [], false, "izinli"),
  row("4", "2026-11-02", ["Akşam"], true, "gec"),
];

describe("report periods", () => {
  it("daily covers only the chosen day", () => {
    expect(periodRange("gunluk", "2026-10-28")).toEqual({ start: "2026-10-28", end: "2026-10-28" });
  });
  it("weekly runs Monday to Sunday", () => {
    expect(periodRange("haftalik", "2026-10-28")).toEqual({ start: "2026-10-26", end: "2026-11-01" });
  });
  it("monthly covers the whole calendar month", () => {
    expect(periodRange("aylik", "2026-02-10")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
  it("yearly covers the whole year", () => {
    expect(periodRange("yillik", "2026-10-28")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
  it("all covers every recorded day", () => {
    expect(periodRange("tumu", "2026-10-28", rows)).toEqual({ start: "2026-01-15", end: "2026-11-02" });
  });
  it("filters rows inside the range", () => {
    expect(filterRows(rows, periodRange("haftalik", "2026-10-28")).map((r) => r.id)).toEqual(["2", "3"]);
  });
});

describe("report summary", () => {
  const students: Student[] = [{ id: "s1", name: "Ali", age: "", group: "", city: "", startDate: "", guardian: "", phone: "", status: "İyi" }];
  it("totals prayers, lessons, late and excused days per student", () => {
    const s = buildReport(students, rows.slice(1)).summary[0]!;
    expect(s).toMatchObject({ gun: 3, kilinan: 6, toplamVakit: 15, namazYuzde: 40, ders: 2, dersYuzde: 67, gec: 1, izinli: 1 });
  });
});

describe("file names", () => {
  it("turns Turkish names into safe file names", () => {
    expect(fileSlug("Ahmet Yılmaz")).toBe("ahmet-yilmaz");
    expect(fileSlug("İsmail Çağrı Öztürk")).toBe("ismail-cagri-ozturk");
  });
});

describe("buildChart (namaz takip çizelgesi)", () => {
  const st = [{ id: "a", name: "Ali" }, { id: "b", name: "Bekir" }] as never[];
  const row = (studentId: string, date: string, vakitler: string[], durum = "normal") => ({ id: studentId + date, studentId, date, vakitler, ders: false, durum }) as never;
  const c = buildChart(st, [
    row("a", "2026-10-01", ["Sabah", "Öğle"]),
    row("a", "2026-10-02", []),
    row("b", "2026-10-01", [], "izinli"),
    row("a", "2026-10-03", ["Yatsı"]),
  ]);
  it("ticks prayed vakit and marks the rest with X", () => {
    expect(c.rows[0]!.days[0]).toEqual(["✓", "✓", "X", "X", "X"]);
  });
  it("counts days attended and missed", () => {
    expect(c.rows[0]!.katildi).toBe(2);
    expect(c.rows[0]!.katilmadi).toBe(1);
  });
  it("counts a day with no record as missed, izinli as neither", () => {
    expect(c.rows[1]!.days[0]).toEqual(["İ", "İ", "İ", "İ", "İ"]);
    expect(c.rows[1]!.katildi).toBe(0);
    expect(c.rows[1]!.katilmadi).toBe(2);
  });
});

describe("chartByMonth", () => {
  const st = [{ id: "a", name: "Ali" }] as never[];
  const row = (date: string, vakitler: string[]) => ({ id: date, studentId: "a", date, vakitler, ders: false, durum: "normal" }) as never;
  const months = chartByMonth(buildChart(st, [row("2026-09-30", ["Sabah"]), row("2026-10-01", []), row("2026-10-02", ["Yatsı"])]));
  it("makes one chart per month in order", () => {
    expect(months.map((m) => m.label)).toEqual(["Eylül 2026", "Ekim 2026"]);
  });
  it("counts days per month only", () => {
    expect(months[0]!.rows[0]).toMatchObject({ katildi: 1, katilmadi: 0 });
    expect(months[1]!.rows[0]).toMatchObject({ katildi: 1, katilmadi: 1 });
  });
});
