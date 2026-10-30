import { describe, expect, it } from "vitest";
import { buildReport, fileSlug, filterRows, periodRange } from "./report";
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
