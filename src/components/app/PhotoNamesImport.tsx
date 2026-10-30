import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { extractStudentNames } from "@/lib/names-ai.functions";
import { useStore } from "@/lib/store";
import { emptyStudent } from "./StudentForm";
import { inputCls, primaryBtn } from "./Sheet";
import { ImagePlus, Sparkles } from "./icons";

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

type Row = { name: string; on: boolean; exists: boolean };

export function PhotoNamesImport({ onDone }: { onDone: (count: number) => void }) {
  const { students, addStudent } = useStore();
  const extract = useServerFn(extractStudentNames);
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [group, setGroup] = useState(emptyStudent.group);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const analyze = async () => {
    setBusy(true); setErr(""); setRows([]);
    try {
      const images = await Promise.all(files.map(toDataUrl));
      const res = await extract({ data: { images } });
      if (!res.ok) { setErr(res.error); return; }
      if (!res.names.length) { setErr("Fotoğrafta isim bulunamadı."); return; }
      const have = new Set(students.map((s) => s.name.toLocaleLowerCase("tr")));
      setRows(res.names.map((name) => { const exists = have.has(name.toLocaleLowerCase("tr")); return { name, on: !exists, exists }; }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bir hata oldu, tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const chosen = rows.filter((r) => r.on && r.name.trim());
    chosen.forEach((r) => addStudent({ ...emptyStudent, name: r.name.trim(), group }));
    onDone(chosen.length);
  };
  const upd = (i: number, p: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const selected = rows.filter((r) => r.on).length;

  return (
    <div className="mb-5 rounded-2xl border border-border bg-surface p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Fotoğraftan isim ekle</p>
      <p className="mt-1 text-xs text-muted-foreground">İsim listesinin fotoğrafını seçin, yapay zekâ isimleri okusun.</p>
      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-3 text-sm">
        <ImagePlus className="h-4 w-4 text-primary" /> {files.length ? `${files.length} fotoğraf seçildi` : "Fotoğraf seç (en fazla 6)"}
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { setFiles(Array.from(e.target.files ?? []).slice(0, 6)); setRows([]); setErr(""); }} />
      </label>
      {files.length > 0 && !rows.length && (
        <button type="button" className={`${primaryBtn} mt-3`} disabled={busy} onClick={analyze}>{busy ? "İsimler okunuyor…" : "Yapay Zekâ ile Analiz Et"}</button>
      )}
      {err && <p className="mt-2 text-center text-sm text-destructive">{err}</p>}
      {rows.length > 0 && (
        <div className="mt-3">
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="checkbox" checked={r.on} onChange={(e) => upd(i, { on: e.target.checked })} className="h-5 w-5 accent-primary" />
                <input className={inputCls} value={r.name} onChange={(e) => upd(i, { name: e.target.value })} />
                {r.exists && <span className="shrink-0 text-xs text-muted-foreground">zaten var</span>}
              </div>
            ))}
          </div>
          <select className={`${inputCls} mt-3`} value={group} onChange={(e) => setGroup(e.target.value)}>
            <option>Daimi Grup</option><option>Hafızlık</option><option>Yaz Kursu</option><option>Hafta Sonu</option>
          </select>
          <button type="button" className={`${primaryBtn} mt-3`} disabled={!selected} onClick={save}>{selected} Talebeyi Ekle</button>
        </div>
      )}
    </div>
  );
}
