import { describe, expect, it } from "vitest";
import { buildFullTutanakPrompt, parseAiTutanak, trDate } from "./ai-tutanak";

describe("AI tutanak", () => {
  it("formats the date in Turkish", () => {
    expect(trDate("2026-10-30")).toBe("30 Ekim 2026");
    expect(trDate("2026-02-05")).toBe("5 Şubat 2026");
  });

  it("gives the AI the child's name and the date", () => {
    const p = buildFullTutanakPrompt({ name: "Ahmet Yılmaz", date: "2026-10-30", positive: false, category: "", note: "arkadaşlarıyla kavga etti" });
    expect(p).toContain("Talebenin adı: Ahmet Yılmaz");
    expect(p).toContain("Olay tarihi: 30 Ekim 2026");
    expect(p).toContain("arkadaşlarıyla kavga etti");
  });

  it("reads the AI's JSON reply", () => {
    const r = parseAiTutanak('```json\n{"baslik":"Kavga Olayı","kategori":"Disiplinsizlik","metin":"Uzun metin."}\n```', { title: "x", tag: "y" });
    expect(r).toEqual({ title: "Kavga Olayı", tag: "Disiplinsizlik", body: "Uzun metin." });
  });

  it("keeps plain text replies as the tutanak text", () => {
    const r = parseAiTutanak("Sadece düz metin.", { title: "Tutanak", tag: "Diğer" });
    expect(r).toEqual({ title: "Tutanak", tag: "Diğer", body: "Sadece düz metin." });
  });
});
