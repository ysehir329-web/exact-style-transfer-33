import { localIso } from "@/lib/utils";
import { useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, FileText, Loader2, Sparkles } from "./icons";
import { inputCls, primaryBtn } from "./Sheet";
import { polishTutanak } from "@/lib/tutanak-ai.functions";
import { newFileId, prepareFile, putFile, type StoredFile } from "@/lib/attachments";
import type { Tutanak } from "@/lib/store";

export const TUTANAK_TAGS = ["Namaza Katılmama", "Derse Geç Kalma", "Disiplinsizlik", "Arkadaşlarıyla Tartışma", "Güzel Davranış", "Başarı", "Diğer"];
const today = () => localIso();
const label = "mb-1.5 block text-sm font-medium";

function FilePick({ icon: Icon, title, accept, file, onPick }: {
  icon: typeof Camera; title: string; accept: string; file: StoredFile | null; onPick: (f: File | undefined) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="min-w-0">
      <p className={`${label} flex items-center gap-1.5`}><Icon className="h-4 w-4" /> {title}</p>
      <button type="button" onClick={() => ref.current?.click()} className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm">
        <span className="shrink-0 font-medium">Dosyayı Seç</span>
        <span className="truncate text-muted-foreground">{file ? file.name : "seçilmedi"}</span>
      </button>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

export function TutanakForm({ onSubmit, onCancel }: {
  onSubmit: (t: Omit<Tutanak, "id" | "studentId">) => void;
  onCancel: () => void;
}) {
  const polish = useServerFn(polishTutanak);
  const [f, setF] = useState({ positive: false, date: today(), tag: TUTANAK_TAGS[1]!, title: "", body: "", signed: false });
  const [photo, setPhoto] = useState<StoredFile | null>(null);
  const [doc, setDoc] = useState<StoredFile | null>(null);
  const [portrait, setPortrait] = useState<StoredFile | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [prevBody, setPrevBody] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pick = (set: (v: StoredFile | null) => void) => async (file?: File) => {
    if (file) set(await prepareFile(file));
  };

  const runAi = async () => {
    if (!f.body.trim()) { setAiMsg("Önce tutanak metnini yazın."); return; }
    setAiBusy(true); setAiMsg("");
    try {
      const res = await polish({ data: { text: f.body, category: f.tag, positive: f.positive } });
      if (res.ok) { setPrevBody(f.body); setF((p) => ({ ...p, body: res.text })); setAiMsg("Metin düzenlendi."); }
      else setAiMsg(res.error);
    } catch (e) {
      setAiMsg(e instanceof Error ? e.message : "AI ile düzenleme yapılamadı.");
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let photoId: string | undefined;
      let docId: string | undefined;
      if (photo) { photoId = newFileId(); await putFile(photoId, photo); }
      if (doc) { docId = newFileId(); await putFile(docId, doc); }
      let studentPhotoId: string | undefined;
      if (portrait) { studentPhotoId = newFileId(); await putFile(studentPhotoId, portrait); }
      onSubmit({ ...f, title: f.title.trim() || f.tag, photoId, docId, studentPhotoId });
    } catch {
      setAiMsg("Dosya kaydedilemedi. Telefonda yer kalmamış olabilir.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className={label}>Tür</span>
          <select className={inputCls} value={f.positive ? "1" : "0"} onChange={(e) => setF({ ...f, positive: e.target.value === "1" })}>
            <option value="0">Olumsuz</option>
            <option value="1">Olumlu</option>
          </select>
        </div>
        <div>
          <span className={label}>Tarih</span>
          <input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </div>
      </div>

      <div>
        <span className={label}>Kategori</span>
        <select className={inputCls} value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })}>
          {TUTANAK_TAGS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <span className={label}>Başlık</span>
        <input className={inputCls} placeholder="Kısa başlık" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Tutanak Metni (ham notlar)</span>
          <button type="button" onClick={runAi} disabled={aiBusy} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium disabled:opacity-60">
            {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiBusy ? "Düzenleniyor…" : "AI ile Düzenle"}
          </button>
        </div>
        <textarea rows={5} className={inputCls} placeholder="Olayı buraya yazın veya yapıştırın..." value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        {(aiMsg || prevBody !== null) && (
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{aiMsg}</span>
            {prevBody !== null && (
              <button type="button" className="text-primary" onClick={() => { setF((p) => ({ ...p, body: prevBody })); setPrevBody(null); setAiMsg(""); }}>Geri al</button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FilePick icon={Camera} title="Fotoğraf Kanıtı" accept="image/*" file={photo} onPick={pick(setPhoto)} />
        <FilePick icon={FileText} title="İmzalı Belge" accept="image/*,application/pdf" file={doc} onPick={pick(setDoc)} />
      </div>
      <FilePick icon={Camera} title="Talebe Resmi (PDF'te sağ üstte)" accept="image/*" file={portrait} onPick={pick(setPortrait)} />

      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={f.signed} onChange={(e) => setF({ ...f, signed: e.target.checked })} />
        Velisi tarafından imzalandı
      </label>

      <div className="space-y-2">
        <button className={primaryBtn} disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet"}</button>
        <button type="button" onClick={onCancel} className="w-full rounded-xl border border-border bg-card py-3 text-sm">İptal</button>
      </div>
    </form>
  );
}
