import { VAKITLER } from "./stats";
import { chartByMonth, type buildChart, type buildReport } from "./report";

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

type Pdf = import("jspdf").jsPDF;
type MonthChart = ReturnType<typeof chartByMonth>[number];

const DAYS_PER_PAGE = 10, ROWS_PER_PAGE = 28;

/** Landscape namaz takip çizelgesi pages for one month (✓ / X / İ grid + day counts). */
function chartPdfPages(doc: Pdf, m: MonthChart, first: boolean) {
  const W = 297, L = 10, R = 10, V = VAKITLER.length;
  const noW = 7, nameW = 44, cntW = 11;
  const dayChunks: number[][] = [];
  const per = Math.ceil(m.days.length / Math.max(1, Math.ceil(m.days.length / DAYS_PER_PAGE))) || 1;
  for (let i = 0; i < Math.max(1, m.days.length); i += per) dayChunks.push(m.days.slice(i, i + per).map((_, k) => i + k));
  const rowChunks: number[][] = [];
  for (let i = 0; i < Math.max(1, m.rows.length); i += ROWS_PER_PAGE) rowChunks.push(m.rows.slice(i, i + ROWS_PER_PAGE).map((_, k) => i + k));
  let firstPage = first;
  for (const days of dayChunks)
    for (const rows of rowChunks) {
      if (!firstPage) doc.addPage("a4", "landscape");
      firstPage = false;
      const vw = Math.min(4.2, (W - L - R - noW - nameW - 2 * cntW) / Math.max(1, days.length * V));
      const tableW = noW + nameW + days.length * V * vw + 2 * cntW;
      const x0 = L + (W - L - R - tableW) / 2;
      const xv = x0 + noW + nameW, xc = xv + days.length * V * vw;
      const yT = 10, yD = 18, yV = 24, yH = 42, rh = 5.6;
      doc.setDrawColor(0); doc.setLineWidth(0.2); doc.setTextColor(0);
      doc.rect(x0, yT, tableW, yD - yT);
      doc.setFont("DejaVu", "bold"); doc.setFontSize(12);
      doc.text(`${m.label.toLocaleUpperCase("tr")} · NAMAZ TAKİP ÇİZELGESİ`, x0 + tableW / 2, yT + 5.6, { align: "center" });
      // header cells
      days.forEach((di, k) => {
        const x = xv + k * V * vw;
        doc.setFillColor(229, 241, 235);
        doc.rect(x, yD, V * vw, yV - yD, "FD");
        doc.setFontSize(Math.min(7.5, V * vw * 0.42)); doc.setFont("DejaVu", "bold");
        const d = m.days[di]!;
        doc.text(`${d.slice(8, 10)}.${d.slice(5, 7)}`, x + (V * vw) / 2, yD + 4.1, { align: "center" });
        VAKITLER.forEach((v, j) => {
          const cx = x + j * vw;
          doc.rect(cx, yV, vw, yH - yV);
          doc.setFontSize(Math.min(6, vw * 1.7));
          doc.text(v.toLocaleUpperCase("tr"), cx + vw / 2 + 0.9, yH - 1.5, { angle: 90 });
        });
      });
      doc.rect(x0, yD, noW, yH - yD); doc.rect(x0 + noW, yD, nameW, yH - yD);
      doc.setFontSize(7.5);
      doc.text("NO", x0 + noW / 2, yH - 2, { align: "center" });
      doc.text("ADI SOYADI", x0 + noW + nameW / 2, yH - 2, { align: "center" });
      doc.text("NAMAZ", x0 + noW + nameW / 2, yV + 6, { align: "center" });
      (["KATILDIĞI GÜN", "KATILMADIĞI GÜN"] as const).forEach((h, j) => {
        const x = xc + j * cntW;
        if (j) doc.setFillColor(250, 230, 230); else doc.setFillColor(229, 241, 235);
        doc.rect(x, yD, cntW, yH - yD, "FD");
        doc.setFontSize(6.3);
        const [a, b] = h.split(" ");
        doc.text(a!, x + cntW / 2 - 0.6, yH - 2, { angle: 90 });
        doc.text(b!, x + cntW / 2 + 2.9, yH - 2, { angle: 90 });
      });
      // body
      rows.forEach((ri, k) => {
        const r = m.rows[ri]!;
        const y = yH + k * rh;
        doc.setTextColor(0); doc.setFont("DejaVu", "normal"); doc.setFontSize(7.5);
        doc.rect(x0, y, noW, rh); doc.text(String(ri + 1), x0 + noW / 2, y + 3.9, { align: "center" });
        doc.rect(x0 + noW, y, nameW, rh);
        doc.setFont("DejaVu", "bold"); doc.setFontSize(7);
        const nm = doc.splitTextToSize(r.name, nameW - 2) as string[];
        doc.text(nm[0]!, x0 + noW + 1, y + 3.8);
        days.forEach((di, kk) => r.days[di]!.forEach((mark, j) => {
          const cx = xv + (kk * V + j) * vw;
          doc.rect(cx, y, vw, rh);
          const col: [number, number, number] = mark === "✓" ? [30, 123, 79] : mark === "X" ? [196, 52, 52] : [116, 82, 170];
          doc.setTextColor(col[0], col[1], col[2]);
          doc.setFontSize(Math.min(8, vw * 2.3));
          doc.text(mark, cx + vw / 2, y + 3.9, { align: "center" });
        }));
        doc.setFontSize(9);
        doc.setTextColor(30, 123, 79); doc.rect(xc, y, cntW, rh); doc.text(String(r.katildi), xc + cntW / 2, y + 4, { align: "center" });
        doc.setTextColor(196, 52, 52); doc.rect(xc + cntW, y, cntW, rh); doc.text(String(r.katilmadi), xc + cntW * 1.5, y + 4, { align: "center" });
      });
      doc.setTextColor(0);
    }
}

export async function makePdf({ report, chart, title, rangeText }: ExportInput): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }, [regular, bold]] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    loadFonts(),
  ]);
  const months = chart ? chartByMonth(chart) : [];
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: months.length ? "landscape" : "portrait" });
  doc.addFileToVFS("DejaVuSans.ttf", regular);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", bold);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
  months.forEach((m, i) => chartPdfPages(doc, m, i === 0));
  if (months.length) doc.addPage("a4", "portrait");

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
    const { width, height } = doc.internal.pageSize;
    doc.text(`Kur'an Kursu · Sayfa ${i}/${pages}`, width / 2, height - 6, { align: "center" });
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
  if (chart)
    for (const m of chartByMonth(chart))
      XLSX.utils.book_append_sheet(wb, chartSheet(XLSX, m, `${m.label} · Namaz Takip Çizelgesi`) as never, m.label);

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
