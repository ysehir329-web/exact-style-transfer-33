import { VAKITLER } from "./stats";
import type { buildReport } from "./report";

type Report = ReturnType<typeof buildReport>;
export type ExportInput = { report: Report; title: string; rangeText: string; fileBase: string };

const SUMMARY_HEAD = ["Talebe", "Gün", "Kılınan Vakit", "Namaz %", "Ders", "Ders %", "Geç", "İzinli"];
const DETAIL_HEAD = ["Tarih", "Talebe", ...VAKITLER, "Ders", "Durum"];

const summaryBody = (r: Report) =>
  r.summary.map((s) => [s.name, s.gun, `${s.kilinan}/${s.toplamVakit}`, `%${s.namazYuzde}`, s.ders, `%${s.dersYuzde}`, s.gec, s.izinli]);

const dayLabel = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

let fontCache: Promise<[string, string]> | null = null;
export function loadFonts() {
  const toB64 = async (url: string) => {
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  };
  fontCache ??= Promise.all([toB64("/fonts/DejaVuSans.ttf"), toB64("/fonts/DejaVuSans-Bold.ttf")]).catch((e) => {
    fontCache = null;
    throw e;
  });
  return fontCache;
}

export async function makePdf({ report, title, rangeText }: ExportInput): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }, [regular, bold]] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    loadFonts(),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("DejaVuSans.ttf", regular);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", bold);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");

  const green: [number, number, number] = [34, 99, 74];
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(rangeText, 14, 25);
  doc.setTextColor(0);

  const base = {
    styles: { font: "DejaVu", fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: green, textColor: 255, fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [244, 247, 245] as [number, number, number] },
    margin: { left: 14, right: 14 },
  };

  doc.setFont("DejaVu", "bold");
  doc.setFontSize(12);
  doc.text("Özet", 14, 34);
  autoTable(doc, { ...base, startY: 37, head: [SUMMARY_HEAD], body: summaryBody(report) });

  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(12);
  doc.text("Günlük Detay", 14, y);
  autoTable(doc, {
    ...base,
    startY: y + 3,
    head: [DETAIL_HEAD],
    body: report.detail.map((d) => [dayLabel(d.date), d.name, ...d.vakitler.map((v) => (v ? "✓" : "–")), d.ders ? "✓" : "–", d.durum]),
    columnStyles: Object.fromEntries([2, 3, 4, 5, 6, 7].map((i) => [i, { halign: "center" as const }])),
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Kur'an Kursu · Sayfa ${i}/${pages}`, 105, 290, { align: "center" });
  }
  return doc.output("blob");
}

export async function makeXlsx({ report, title, rangeText }: ExportInput): Promise<Blob> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const summary = XLSX.utils.aoa_to_sheet([
    [title],
    [rangeText],
    [],
    SUMMARY_HEAD,
    ...report.summary.map((s) => [s.name, s.gun, s.kilinan, s.namazYuzde / 100, s.ders, s.dersYuzde / 100, s.gec, s.izinli]),
  ]);
  summary["!cols"] = [{ wch: 24 }, { wch: 7 }, { wch: 13 }, { wch: 10 }, { wch: 7 }, { wch: 9 }, { wch: 7 }, { wch: 8 }];
  for (let r = 4; r < 4 + report.summary.length; r++)
    for (const c of ["D", "F"]) {
      const cell = summary[`${c}${r + 1}`];
      if (cell) cell.z = "0%";
    }
  XLSX.utils.book_append_sheet(wb, summary, "Özet");

  const detail = XLSX.utils.aoa_to_sheet([
    DETAIL_HEAD,
    ...report.detail.map((d) => [dayLabel(d.date), d.name, ...d.vakitler.map((v) => (v ? "✓" : "")), d.ders ? "✓" : "", d.durum]),
  ]);
  detail["!cols"] = [{ wch: 12 }, { wch: 24 }, ...VAKITLER.map(() => ({ wch: 8 })), { wch: 7 }, { wch: 11 }];
  XLSX.utils.book_append_sheet(wb, detail, "Günlük Detay");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function deliverFile(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return;
    }
  }
  downloadBlob(blob, filename);
}
