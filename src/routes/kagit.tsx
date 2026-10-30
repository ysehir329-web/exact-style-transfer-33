import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Avatar } from "@/components/app/AppShell";
import { useStore } from "@/lib/store";
import { VAKITLER } from "@/lib/stats";
import { localIso } from "@/lib/utils";
import { analyzePaperAttendance, type PaperRow } from "@/lib/paper-ai.functions";
import { Calendar, FileText, Camera, ImagePlus, Sparkles, Save, Check } from "@/components/app/icons";

export const Route = createFileRoute("/kagit")({
  head: () => ({
    meta: [
      { title: "Kâğıt Yoklama — Kur'an Kursu" },
      { name: "description", content: "Kâğıt yoklamanın fotoğrafını yükleyin, yapay zekâ kayıtları çıkarsın." },
      { property: "og:title", content: "Kâğıt Yoklama — Kur'an Kursu" },
      { property: "og:description", content: "Kâğıt yoklamanın fotoğrafını yükleyin, yapay zekâ kayıtları çıkarsın." },
    ],
  }),
  component: Kagit,
});

const fmt = (s: string) => new Date(s + "T12:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
const monthStart = () => { const n = new Date(); return localIso(new Date(n.getFullYear(), n.getMonth(), 1)); };
const MAX_FILES = 6;
const cols = [...VAKITLER, "Ders"];

/** Shrink a photo to max 1600px JPEG so uploads stay fast on phones. */
async function toDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.85);
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <label className="relative flex-1 rounded-xl border border-border py-3 text-center text-base">
          {fmt(value)}
          <input type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="absolute inset-0 opacity-0" />
        </label>
      </div>
    </div>
  );
}

function Kagit() {
  const { students, saveDay } = useStore();
  const analyze = useServerFn(analyzePaperAttendance);
  const [start, setStart] = useState(monthStart);
  const [end, setEnd] = useState(() => localIso());
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<PaperRow[] | null>(null);
  const [saved, setSaved] = useState(false);
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "?";

  const addFiles = (list: FileList | null) => {
    setFiles((f) => [...f, ...Array.from(list ?? [])].slice(0, MAX_FILES));
    setRows(null); setSaved(false); setError("");
  };

  const run = async () => {
    setBusy(true); setError(""); setRows(null); setSaved(false);
    try {
      if (start > end) throw new Error("Başlangıç tarihi bitişten sonra olamaz.");
      const images = await Promise.all(files.map(toDataUrl));
      const res = await analyze({ data: { images, students: students.map((s) => ({ id: s.id, name: s.name })), start, end } });
      if (!res.ok) setError(res.error);
      else if (!res.rows.length) setError("Fotoğrafta kayıtlı talebelerle eşleşen yoklama bulunamadı.");
      else setRows(res.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analiz yapılamadı. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (i: number, c: string) => {
    setRows((rs) => rs!.map((r, j) => j !== i ? r : c === "Ders" ? { ...r, ders: !r.ders } : { ...r, vakitler: r.vakitler.includes(c) ? r.vakitler.filter((v) => v !== c) : VAKITLER.filter((v) => v === c || r.vakitler.includes(v)) }));
    setSaved(false);
  };

  const save = () => {
    const byDate: Record<string, PaperRow[]> = {};
    for (const r of rows ?? []) (byDate[r.date] ??= []).push(r);
    for (const [date, list] of Object.entries(byDate)) saveDay(date, list.map((r) => ({ studentId: r.studentId, vakitler: r.vakitler, ders: r.ders, durum: "normal" as const })));
    setSaved(true);
  };

  return (
    <>
      <h2 className="mt-7 font-serif text-3xl font-bold">Kâğıt Yoklama</h2>
      <p className="mt-2 text-sm text-muted-foreground">Haftalık veya aylık kâğıt yoklamanın fotoğrafını yükleyin — yapay zekâ kayıtları çıkarır, kontrol edip kaydedersiniz.</p>
      <div className="mt-5 rounded-2xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-3 font-serif text-lg font-bold"><FileText className="h-5 w-5 text-primary" /> Kâğıt Yoklama (Haftalık / Aylık)</h3>
        <DateField label="Başlangıç Tarihi" value={start} onChange={setStart} />
        <DateField label="Bitiş Tarihi" value={end} onChange={setEnd} />
        <button onClick={() => { setStart(monthStart()); setEnd(localIso()); }} className="mt-4 w-full rounded-xl border border-border py-2 text-sm">Bu Ay</button>
        <p className="mt-5 text-xs text-muted-foreground">Çizelge Fotoğrafları (en fazla {MAX_FILES})</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="flex items-center gap-3 rounded-xl border border-dashed border-border px-5 py-2 text-sm text-muted-foreground">
            <Camera className="h-4 w-4" /> Fotoğraf Çek
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-dashed border-border px-5 py-2 text-sm text-muted-foreground">
            <ImagePlus className="h-4 w-4" /> Galeriden Seç
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        {files.length > 0 && (
          <p className="mt-2 flex items-center gap-3 text-xs text-primary">
            {files.length} fotoğraf seçildi
            <button onClick={() => { setFiles([]); setRows(null); }} className="underline">Temizle</button>
          </p>
        )}
        {students.length === 0 && <p className="mt-3 text-xs text-destructive">Analiz için önce Menü'den talebe ekleyin.</p>}
        <button onClick={run} disabled={!files.length || !students.length || busy} className="mt-4 flex items-center gap-3 rounded-xl bg-primary px-6 py-2.5 text-sm text-primary-foreground disabled:opacity-50">
          <Sparkles className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} /> {busy ? "Analiz ediliyor… (1 dk sürebilir)" : "AI ile Analiz Et"}
        </button>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      {rows && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <h3 className="font-serif text-lg font-bold">Kontrol Tablosu</h3>
          <p className="mt-1 text-xs text-muted-foreground">Yanlış okunan hücreye dokunarak düzeltin, sonra kaydedin. Aynı gün için önceki yoklama üzerine yazılır.</p>
          <div className="mt-3 space-y-2">
            {rows.map((r, i) => (
              <div key={r.studentId + r.date} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={nameOf(r.studentId)} size="sm" />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{nameOf(r.studentId)}</p>
                  <span className="text-xs text-muted-foreground">{fmt(r.date)}</span>
                </div>
                <div className="mt-2 grid grid-cols-6 gap-1">
                  {cols.map((c) => {
                    const on = c === "Ders" ? r.ders : r.vakitler.includes(c);
                    return (
                      <button key={c} onClick={() => toggle(i, c)} className={`rounded-lg py-1.5 text-[11px] ${on ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground"}`}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <button onClick={save} disabled={saved} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm text-primary-foreground disabled:opacity-60">
            {saved ? <><Check className="h-4 w-4" /> Kaydedildi</> : <><Save className="h-4 w-4" /> {rows.length} Kaydı Yoklamaya Kaydet</>}
          </button>
        </div>
      )}
    </>
  );
}
