import { VAKITLER } from "./stats";
import type { buildChart, buildReport } from "./report";

type Report = ReturnType<typeof buildReport>;
export type ExportInput = { report: Report; chart?: ReturnType<typeof buildChart>; title: string; rangeText: string; fileBase: string };

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

type XL = typeof import("xlsx-js-style");

/** Namaz takip çizelgesi sheet, laid out like the kurs's paper chart. */
function chartSheet(XLSX: XL, chart: NonNullable<ExportInput["chart"]>, title: string) {
  const V = VAKITLER.length;
  const first = 2, last = first + chart.days.length * V; // 0-based col after vakit block
  const ws: Record<string, unknown> = {};
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const thin = { style: "thin", color: { rgb: "000000" } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };
  const put = (r: number, c: number, v: string | number, s: Record<string, unknown> = {}) => {
    ws[XLSX.utils.encode_cell({ r, c })] = {
      v, t: typeof v === "number" ? "n" : "s",
      s: { border, alignment: { horizontal: "center", vertical: "center", wrapText: true }, font: { name: "Arial", sz: 9 }, ...s },
    };
  };
  const bold = (sz = 9) => ({ font: { name: "Arial", sz, bold: true } });
  const vert = { alignment: { horizontal: "center", vertical: "center", textRotation: 90 } };
  const fillG = { fill: { fgColor: { rgb: "E5F1EB" } } };

  for (let c = 0; c <= last + 1; c++) put(0, c, c === 0 ? title.toLocaleUpperCase("tr") : "", bold(12));
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: last + 1 } });
  put(1, 0, ""); put(1, 1, "");
  put(2, 0, ""); put(2, 1, "NAMAZ", bold());
  put(3, 0, "NO", bold()); put(3, 1, "ADI SOYADI", bold());
  chart.days.forEach((d, i) => {
    const c0 = first + i * V;
    for (let k = 0; k < V; k++) {
      put(1, c0 + k, k ? "" : dayLabel(d), { ...bold(), ...fillG });
      put(2, c0 + k, VAKITLER[k]!.toLocaleUpperCase("tr"), { ...bold(8), ...vert });
      put(3, c0 + k, "");
    }
    merges.push({ s: { r: 1, c: c0 }, e: { r: 1, c: c0 + V - 1 } });
  });
  ["KATILDIĞI GÜN", "KATILMADIĞI GÜN"].forEach((h, j) => {
    for (let r = 1; r <= 3; r++) put(r, last + j, r === 1 ? h : "", { ...bold(8), ...vert, ...(j ? { fill: { fgColor: { rgb: "FAE6E6" } } } : fillG) });
    merges.push({ s: { r: 1, c: last + j }, e: { r: 3, c: last + j } });
  });

  chart.rows.forEach((row, i) => {
    const r = 4 + i;
    put(r, 0, i + 1);
    put(r, 1, row.name, { ...bold(8), alignment: { horizontal: "left", vertical: "center" } });
    row.days.forEach((marks, di) => marks.forEach((m, k) => {
      const color = m === "✓" ? "1E7B4F" : m === "X" ? "C43434" : "7452AA";
      put(r, first + di * V + k, m, { font: { name: "Arial", sz: 10, bold: true, color: { rgb: color } } });
    }));
    put(r, last, row.katildi, { ...bold(10), font: { name: "Arial", sz: 10, bold: true, color: { rgb: "1E7B4F" } } });
    put(r, last + 1, row.katilmadi, { font: { name: "Arial", sz: 10, bold: true, color: { rgb: "C43434" } } });
  });

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 3 + Math.max(1, chart.rows.length), c: last + 1 } });
  ws["!merges"] = merges;
  ws["!cols"] = [{ wch: 4 }, { wch: 24 }, ...Array.from({ length: last - first }, () => ({ wch: 3 })), { wch: 6 }, { wch: 6 }];
  ws["!rows"] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 52 }, { hpt: 16 }];
  return ws;
}

export async function makeXlsx({ report, chart, title, rangeText }: ExportInput): Promise<Blob> {
  const XLSX = (await import("xlsx-js-style")) as unknown as XL & typeof import("xlsx");
  const wb = XLSX.utils.book_new();
  if (chart) XLSX.utils.book_append_sheet(wb, chartSheet(XLSX, chart, `${title} · Namaz Takip Çizelgesi`) as never, "Namaz Takip");

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
