import { localIso } from "@/lib/utils";
// Colourful student PDFs (full family report and single tutanak), built from data with jsPDF.
// jsPDF / pdf-lib load lazily so they never slow app startup.
import type { AttendanceRow, Student, Tutanak } from "./store";
import { computeStats, monthly, VAKITLER } from "./stats";
import { getFile } from "./attachments";
import { loadFonts } from "./report-export";
import { fileSlug } from "./report";

type RGB = [number, number, number];
type Doc = import("jspdf").jsPDF;

const C = {
  green: [34, 99, 74], greenMid: [52, 124, 95], greenSoft: [229, 241, 235],
  amber: [212, 138, 28], amberSoft: [252, 241, 220],
  red: [196, 52, 52], redSoft: [250, 230, 230],
  blue: [42, 110, 180], blueSoft: [226, 238, 250],
  violet: [116, 82, 170], violetSoft: [238, 232, 248],
  gray: [115, 115, 110], graySoft: [244, 244, 240], ink: [30, 35, 32], white: [255, 255, 255],
} satisfies Record<string, RGB>;

const PW = 210, M = 14, CW = PW - 2 * M, BOTTOM = 278, TOP = 18;
const fmt = (d: string) => (d && d.length >= 10 ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : d);

type Img = { data: string; w: number; h: number };
type Att = { photo: Img | null; doc: Img | null; docPdf: Uint8Array | null };

async function toImg(blob: Blob): Promise<Img | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s);
    c.height = Math.round(bmp.height * s);
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    return { data: c.toDataURL("image/jpeg", 0.85), w: c.width, h: c.height };
  } catch {
    return null;
  }
}

async function loadAtt(t: Tutanak): Promise<Att> {
  const out: Att = { photo: null, doc: null, docPdf: null };
  const p = t.photoId ? await getFile(t.photoId).catch(() => undefined) : undefined;
  if (p) out.photo = await toImg(p.blob);
  const d = t.docId ? await getFile(t.docId).catch(() => undefined) : undefined;
  if (d) {
    if (d.type === "application/pdf" || d.name.toLowerCase().endsWith(".pdf")) out.docPdf = new Uint8Array(await d.blob.arrayBuffer());
    else out.doc = await toImg(d.blob);
  }
  return out;
}

async function newDoc(): Promise<Doc> {
  const [{ jsPDF }, [regular, bold]] = await Promise.all([import("jspdf"), loadFonts()]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("DejaVuSans.ttf", regular);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", bold);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
  return doc;
}

const fill = (d: Doc, c: RGB) => d.setFillColor(c[0], c[1], c[2]);
const ink = (d: Doc, c: RGB) => d.setTextColor(c[0], c[1], c[2]);
function font(d: Doc, size: number, bold = false, color: RGB = C.ink) {
  d.setFont("DejaVu", bold ? "bold" : "normal");
  d.setFontSize(size);
  ink(d, color);
}

class Flow {
  y = TOP;
  constructor(public doc: Doc) {}
  ensure(h: number) {
    if (this.y + h > BOTTOM) {
      this.doc.addPage();
      this.y = TOP;
    }
  }
}

function header(d: Doc, kicker: string, s: Student) {
  fill(d, C.green);
  d.rect(0, 0, PW, 44, "F");
  fill(d, C.greenMid);
  d.circle(192, 6, 28, "F");
  d.circle(150, 35, 5, "F");
  fill(d, C.amber);
  d.rect(0, 44, PW, 1.6, "F");
  font(d, 8.5, true, [205, 232, 218]);
  d.text(`KUR'AN KURSU · ${kicker.toLocaleUpperCase("tr")}`, M, 13);
  font(d, 8, false, [205, 232, 218]);
  d.text(`Hazırlanma: ${fmt(localIso())}`, PW - M, 13, { align: "right" });
  font(d, 22, true, C.white);
  d.text(s.name, M, 28);
  const sub = [s.age && `${s.age} yaş`, s.group, s.city].filter(Boolean).join("  ·  ");
  if (sub) {
    font(d, 10, false, [215, 238, 226]);
    d.text(sub, M, 36);
  }
}

function infoPanel(f: Flow, s: Student) {
  const d = f.doc;
  const items = ([["Veli", s.guardian], ["Telefon", s.phone], ["Şehir", s.city], ["Kursa Başlangıç", fmt(s.startDate)]] as const).filter(([, v]) => v);
  if (!items.length) return;
  const rows = Math.ceil(items.length / 2);
  const h = rows * 12 + 4;
  fill(d, C.graySoft);
  d.roundedRect(M, f.y, CW, h, 3, 3, "F");
  items.forEach(([l, v], i) => {
    const x = M + 6 + (i % 2) * (CW / 2);
    const y = f.y + 7 + Math.floor(i / 2) * 12;
    font(d, 7.5, false, C.gray);
    d.text(l.toLocaleUpperCase("tr"), x, y);
    font(d, 10.5, true);
    d.text(String(v), x, y + 4.8);
  });
  f.y += h + 8;
}

function section(f: Flow, title: string, color: RGB, right?: string, keepWith = 0) {
  f.ensure(16 + keepWith);
  const d = f.doc;
  fill(d, color);
  d.roundedRect(M, f.y - 4.5, 2.6, 6.5, 1, 1, "F");
  font(d, 13, true);
  d.text(title, M + 6, f.y);
  if (right) {
    font(d, 9, false, C.gray);
    d.text(right, PW - M, f.y, { align: "right" });
  }
  f.y += 6;
}

function statTiles(f: Flow, rows: AttendanceRow[]) {
  const d = f.doc;
  const st = computeStats(rows);
  const tiles: [string, number, RGB, RGB][] = [
    ["Namaza Katıldığı Gün", st.namazGun, C.green, C.greenSoft],
    ["Derse Girdiği", st.ders, C.blue, C.blueSoft],
    ["Geç Kaldığı", st.gec, C.amber, C.amberSoft],
    ["Katılmadığı", st.katilmadi, C.red, C.redSoft],
    ["İzinli Gün", st.izinli, C.violet, C.violetSoft],
    ["Toplam Gün", st.toplam, C.gray, C.graySoft],
  ];
  const w = (CW - 8) / 3, h = 22;
  f.ensure(2 * h + 6);
  tiles.forEach(([l, v, c, soft], i) => {
    const x = M + (i % 3) * (w + 4);
    const y = f.y + Math.floor(i / 3) * (h + 4);
    fill(d, soft);
    d.roundedRect(x, y, w, h, 3, 3, "F");
    fill(d, c);
    d.roundedRect(x, y, 2.2, h, 1, 1, "F");
    font(d, 18, true, c);
    d.text(String(v), x + w / 2, y + 11, { align: "center" });
    font(d, 8.5, false, C.gray);
    d.text(l, x + w / 2, y + 17.5, { align: "center" });
  });
  f.y += 2 * h + 4 + 10;

  section(f, "Namaz Vakitleri", C.green);
  const vw = (CW - 4 * 3) / 5, vh = 24;
  f.ensure(vh + 4);
  VAKITLER.forEach((v, i) => {
    const x = M + i * (vw + 3);
    const n = st.vakit[v] ?? 0;
    const pct = st.toplam ? n / st.toplam : 0;
    fill(d, C.greenSoft);
    d.roundedRect(x, f.y, vw, vh, 3, 3, "F");
    font(d, 8.5, true, C.green);
    d.text(v, x + vw / 2, f.y + 6, { align: "center" });
    font(d, 15, true);
    d.text(String(n), x + vw / 2, f.y + 14, { align: "center" });
    fill(d, C.white);
    d.roundedRect(x + 4, f.y + 18, vw - 8, 2.4, 1.2, 1.2, "F");
    if (pct > 0) {
      fill(d, C.green);
      d.roundedRect(x + 4, f.y + 18, Math.max(2.4, (vw - 8) * pct), 2.4, 1.2, 1.2, "F");
    }
  });
  f.y += vh + 10;

  const months = monthly(rows);
  if (!months.length) return;
  section(f, "Aylık Gelişim", C.amber);
  const h2 = 48;
  f.ensure(h2 + 4);
  fill(d, C.graySoft);
  d.roundedRect(M, f.y, CW, h2, 3, 3, "F");
  font(d, 8, false, C.gray);
  fill(d, C.green);
  d.circle(PW - M - 44, f.y + 5.5, 1.4, "F");
  d.text("Namaz %", PW - M - 41, f.y + 6.5);
  fill(d, C.amber);
  d.circle(PW - M - 22, f.y + 5.5, 1.4, "F");
  d.text("Ders %", PW - M - 19, f.y + 6.5);
  const base = f.y + h2 - 9, maxH = 28, gw = (CW - 12) / months.length, bw = Math.min(7, gw / 4);
  d.setDrawColor(210, 210, 205);
  d.line(M + 6, base, PW - M - 6, base);
  months.forEach((m, i) => {
    const cx = M + 6 + gw * i + gw / 2;
    ([[m.namaz, C.green, -bw - 0.6], [m.ders, C.amber, 0.6]] as const).forEach(([pct, c, off]) => {
      const bh = Math.max(0.8, (maxH * pct) / 100);
      fill(d, c);
      d.roundedRect(cx + off, base - bh, bw, bh, 1, 1, "F");
      font(d, 6.5, false, C.gray);
      d.text(`${pct}`, cx + off + bw / 2, base - bh - 1.2, { align: "center" });
    });
    font(d, 8, true, C.gray);
    d.text(m.ay, cx, base + 5, { align: "center" });
  });
  f.y += h2 + 10;
}

const TX = M + 8, TW = CW - 14;

function tutanakCard(f: Flow, t: Tutanak, a: Att) {
  const d = f.doc;
  const main: RGB = t.positive ? C.green : C.red;
  const soft: RGB = t.positive ? C.greenSoft : C.redSoft;
  font(d, 8, true);
  const pillW = d.getTextWidth(t.tag) + 7;
  font(d, 11.5, true);
  const titleLines = d.splitTextToSize(t.title || t.tag, TW - pillW - 4) as string[];
  font(d, 10);
  const bodyLines = t.body ? (d.splitTextToSize(t.body, TW - 6) as string[]) : [];
  const lh = 4.9;
  const imgs = [a.photo && { img: a.photo, l: "Fotoğraf Kanıtı" }, a.doc && { img: a.doc, l: "İmzalı Belge" }].filter(Boolean) as { img: Img; l: string }[];
  const slotW = imgs.length === 2 ? (TW - 4) / 2 : TW - 2;
  const maxImgH = imgs.length === 2 ? 100 : 125;
  const sizes = imgs.map(({ img }) => {
    let w = slotW, h = (w * img.h) / img.w;
    if (h > maxImgH) { h = maxImgH; w = (h * img.w) / img.h; }
    return { w, h };
  });
  const imgH = sizes.length ? Math.max(...sizes.map((s) => s.h)) + 8 : 0;
  const headH = titleLines.length * 5.2 + 9;
  const bodyH = bodyLines.length ? bodyLines.length * lh + 8 : 0;
  const metaH = 7 + (a.docPdf ? 5 : 0);
  const total = 6 + headH + bodyH + metaH + imgH + 3;

  const drawHead = (y: number) => {
    font(d, 11.5, true);
    d.text(titleLines, TX, y + 6);
    fill(d, main);
    d.roundedRect(PW - M - 5 - pillW, y + 1.5, pillW, 6, 3, 3, "F");
    font(d, 8, true, C.white);
    d.text(t.tag, PW - M - 5 - pillW / 2, y + 5.6, { align: "center" });
    font(d, 8.5, false, C.gray);
    d.text(`${fmt(t.date)}  ·  ${t.positive ? "Olumlu" : "Olumsuz"}`, TX, y + titleLines.length * 5.2 + 5);
    return y + headH;
  };
  const drawMeta = (y: number) => {
    font(d, 9, true, t.signed ? C.green : C.amber);
    d.text(t.signed ? "✓ Velisi tarafından imzalandı" : "Veli imzası bekleniyor", TX, y + 4);
    if (a.docPdf) {
      font(d, 8.5, false, C.gray);
      d.text("İmzalı belge (PDF) raporun sonuna eklenmiştir.", TX, y + 9);
    }
    return y + metaH;
  };
  const drawImgs = (y: number) => {
    let x = TX;
    imgs.forEach(({ img, l }, i) => {
      const s = sizes[i]!;
      const ix = x + (slotW - s.w) / 2;
      d.addImage(img.data, "JPEG", ix, y, s.w, s.h);
      font(d, 7.5, false, C.gray);
      d.text(l, ix, y + s.h + 4);
      x += slotW + 4;
    });
  };

  if (total <= BOTTOM - TOP) {
    f.ensure(total);
    const y0 = f.y;
    fill(d, soft);
    d.roundedRect(M, y0, CW, total, 3, 3, "F");
    fill(d, main);
    d.roundedRect(M, y0, 2.6, total, 1.2, 1.2, "F");
    let y = drawHead(y0 + 3);
    if (bodyLines.length) {
      fill(d, C.white);
      d.roundedRect(TX - 2, y, TW - 2, bodyH - 3, 2, 2, "F");
      font(d, 10);
      d.text(bodyLines, TX + 1, y + 5, { lineHeightFactor: 1.38 });
      y += bodyH;
    }
    y = drawMeta(y);
    if (imgs.length) drawImgs(y + 1);
    f.y = y0 + total + 6;
    return;
  }
  // Very long tutanak: let the text flow across pages.
  f.ensure(headH + 10);
  fill(d, main);
  d.rect(M, f.y, 2.6, headH, "F");
  f.y = drawHead(f.y);
  font(d, 10);
  for (const line of bodyLines) {
    f.ensure(lh);
    font(d, 10);
    d.text(line, TX + 1, f.y + 4);
    f.y += lh;
  }
  f.ensure(metaH);
  f.y = drawMeta(f.y + 2);
  if (imgs.length) {
    f.ensure(imgH);
    drawImgs(f.y + 1);
    f.y += imgH;
  }
  f.y += 6;
}

function signatures(f: Flow) {
  const d = f.doc;
  f.ensure(32);
  const w = (CW - 10) / 2;
  ["Öğretici", "Veli"].forEach((l, i) => {
    const x = M + i * (w + 10);
    font(d, 9, true, C.gray);
    d.text(`${l} Adı Soyadı / İmza`, x, f.y + 6);
    d.setDrawColor(170, 170, 165);
    d.line(x, f.y + 24, x + w, f.y + 24);
  });
  f.y += 30;
}

function footers(d: Doc, name: string) {
  const n = d.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    d.setPage(i);
    fill(d, C.green);
    d.rect(M, 284, CW, 0.5, "F");
    font(d, 7.5, false, C.gray);
    d.text(`Kur'an Kursu · ${name}`, M, 289);
    d.text(`Sayfa ${i}/${n}`, PW - M, 289, { align: "right" });
  }
}

async function finish(d: Doc, pdfs: Uint8Array[]): Promise<Blob> {
  const bytes = d.output("arraybuffer");
  if (!pdfs.length) return new Blob([bytes], { type: "application/pdf" });
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.load(bytes);
  for (const p of pdfs) {
    try {
      const src = await PDFDocument.load(p, { ignoreEncryption: true });
      (await out.copyPages(src, src.getPageIndices())).forEach((pg) => out.addPage(pg));
    } catch {
      /* unreadable attachment: skip */
    }
  }
  const merged = await out.save();
  return new Blob([merged.slice().buffer as ArrayBuffer], { type: "application/pdf" });
}

export async function makeStudentPdf(s: Student, rows: AttendanceRow[], tut: Tutanak[]) {
  const [d, atts] = await Promise.all([newDoc(), Promise.all(tut.map(loadAtt))]);
  header(d, "Aile Raporu", s);
  const f = new Flow(d);
  f.y = 56;
  infoPanel(f, s);
  section(f, "Katılım Özeti", C.green, `${rows.length} günlük kayıt`);
  statTiles(f, rows);
  const pos = tut.filter((t) => t.positive).length;
  section(f, "Tutanaklar & Davranış Kayıtları", C.red, `Olumlu ${pos} · Olumsuz ${tut.length - pos}`, tut.length ? 60 : 0);
  if (!tut.length) {
    font(d, 10, false, C.gray);
    d.text("Kayıtlı tutanak bulunmuyor.", M, f.y + 4);
  }
  tut.forEach((t, i) => tutanakCard(f, t, atts[i]!));
  footers(d, s.name);
  const blob = await finish(d, atts.flatMap((a) => (a.docPdf ? [a.docPdf] : [])));
  return { blob, name: `aile-raporu-${fileSlug(s.name)}.pdf` };
}

export async function makeTutanakPdf(s: Student, t: Tutanak) {
  const [d, att] = await Promise.all([newDoc(), loadAtt(t)]);
  header(d, "Tutanak", s);
  const f = new Flow(d);
  f.y = 56;
  infoPanel(f, s);
  section(f, "Tutanak", t.positive ? C.green : C.red);
  tutanakCard(f, t, att);
  f.y += 6;
  signatures(f);
  footers(d, s.name);
  const blob = await finish(d, att.docPdf ? [att.docPdf] : []);
  return { blob, name: `tutanak-${fileSlug(s.name)}-${t.date}.pdf` };
}
