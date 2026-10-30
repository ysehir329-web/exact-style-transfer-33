import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Loader2, Save, Sparkles } from "@/components/app/icons";
import { inputCls, primaryBtn } from "@/components/app/Sheet";
import { PdfButton } from "@/components/app/PdfButton";
import { TUTANAK_TAGS } from "@/components/app/TutanakForm";
import { writeFullTutanak } from "@/lib/tutanak-ai.functions";
import { trDate, type AiTutanak } from "@/lib/ai-tutanak";
import { useStore, type Student, type Tutanak } from "@/lib/store";
import { localIso } from "@/lib/utils";

export const Route = createFileRoute("/ai-tutanak")({
  head: () => ({
    meta: [
      { title: "AI Tutanak — Kur'an Kursu" },
      { name: "description", content: "Kısa notunuzu yapay zekâ ile talebe adı ve tarih içeren eksiksiz, resmi bir tutanağa dönüştürün." },
      { property: "og:title", content: "AI Tutanak — Kur'an Kursu" },
      { property: "og:description", content: "Kısa notunuzu yapay zekâ ile eksiksiz, resmi bir talebe tutanağına dönüştürün." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiTutanakPage,
});

const OTHER = "__other";
const label = "mb-1.5 block text-sm font-medium";

function AiTutanakPage() {
  const { students, addTutanak } = useStore();
  const write = useServerFn(writeFullTutanak);
  const [studentId, setStudentId] = useState("");
  const [typedName, setTypedName] = useState("");
  const [date, setDate] = useState(localIso());
  const [positive, setPositive] = useState(false);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<AiTutanak | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const listed = students.find((s) => s.id === studentId);
  const manual = studentId === OTHER || students.length === 0;
  const name = manual ? typedName.trim() : listed?.name ?? "";

  const generate = async () => {
    if (!name) { setMsg("Önce talebeyi seçin."); return; }
    if (!note.trim()) { setMsg("Önce kısa notu yazın."); return; }
    setBusy(true); setMsg(""); setSaved(null);
    try {
      const res = await write({ data: { name, date, positive, category, note, group: listed?.group ?? "" } });
      if (res.ok) setResult({ title: res.title, tag: res.tag, body: res.body });
      else setMsg(res.error);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Tutanak hazırlanamadı. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  };

  const tutanak: Tutanak | null = result
    ? { id: "ai", studentId: listed?.id ?? "", title: result.title, tag: result.tag, date, body: result.body, positive, signed: false }
    : null;
  const pdfStudent: Student = listed ?? { id: "", name, age: "", group: "", city: "", startDate: "", guardian: "", phone: "", status: "İyi" };

  const save = () => {
    if (!listed || !tutanak) return;
    addTutanak({ title: tutanak.title, tag: tutanak.tag, date, body: tutanak.body, positive, signed: false, studentId: listed.id });
    setSaved(listed.id);
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard?.writeText(`${result.title}\n${name} — ${trDate(date)}\n\n${result.body}`).catch(() => undefined);
    setMsg("Metin kopyalandı.");
  };

  return (
    <>
      <div className="mt-7 flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-primary" />
        <h2 className="font-serif text-3xl font-bold">AI Tutanak</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Olayı birkaç kelimeyle yazın; yapay zekâ talebenin adı ve tarihiyle eksiksiz bir tutanak hazırlasın.</p>

      <div className="mt-5 space-y-4 rounded-3xl border border-border bg-card p-4">
        <div>
          <span className={label}>Talebe</span>
          {students.length > 0 && (
            <select className={inputCls} value={studentId} onChange={(e) => { setStudentId(e.target.value); setSaved(null); }}>
              <option value="">Talebe seçin…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value={OTHER}>Listede yok — adını yazacağım</option>
            </select>
          )}
          {manual && (
            <input className={`${inputCls} ${students.length ? "mt-2" : ""}`} placeholder="Talebenin adı soyadı" value={typedName} onChange={(e) => setTypedName(e.target.value)} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>Tarih</span>
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <span className={label}>Tür</span>
            <select className={inputCls} value={positive ? "1" : "0"} onChange={(e) => setPositive(e.target.value === "1")}>
              <option value="0">Olumsuz</option>
              <option value="1">Olumlu</option>
            </select>
          </div>
        </div>

        <div>
          <span className={label}>Kategori</span>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">AI seçsin</option>
            {TUTANAK_TAGS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <span className={label}>Kısa not</span>
          <textarea rows={3} className={inputCls} placeholder="Ör: Bugün derste arkadaşlarıyla kavga etti." value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <button type="button" onClick={generate} disabled={busy} className={`${primaryBtn} flex items-center justify-center gap-2`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Tutanak hazırlanıyor…" : result ? "Yeniden Hazırla" : "AI ile Tutanak Hazırla"}
        </button>
        {msg && <p className="text-center text-sm text-primary">{msg}</p>}
      </div>

      {result && tutanak && (
        <div className="mt-5 rounded-3xl border border-border bg-card p-4 shadow-sm">
          <p className="text-center text-xs font-semibold tracking-[0.2em] text-muted-foreground">TALEBE TUTANAĞI</p>
          <textarea
            rows={2}
            className="mt-2 w-full resize-none bg-transparent text-center font-serif text-xl font-bold leading-snug outline-none"
            value={result.title}
            onChange={(e) => setResult({ ...result, title: e.target.value })}
          />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="rounded-full bg-surface px-3 py-1 font-medium">{name}</span>
            <span className="rounded-full bg-surface px-3 py-1">{trDate(date)}</span>
            <span className={`rounded-full px-3 py-1 ${positive ? "bg-good text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>{result.tag}</span>
          </div>
          <textarea
            rows={14}
            className={`${inputCls} mt-4 leading-relaxed`}
            value={result.body}
            onChange={(e) => setResult({ ...result, body: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">Metni dilediğiniz gibi düzeltebilirsiniz.</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <PdfButton
              make={() => import("@/lib/student-pdf").then((m) => m.makeTutanakPdf(pdfStudent, tutanak))}
              depsKey={JSON.stringify([tutanak, pdfStudent])}
              label="PDF İndir"
              className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-soft px-3 py-3 text-sm font-medium text-primary"
            />
            <button type="button" onClick={copy} className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-3 text-sm">
              Kopyala
            </button>
          </div>

          {listed ? (
            saved === listed.id ? (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-good">
                <Check className="h-4 w-4" /> {listed.name} dosyasına kaydedildi.{" "}
                <Link to="/talebe/$name" params={{ name: listed.id }} className="font-medium underline">Görüntüle</Link>
              </p>
            ) : (
              <button type="button" onClick={save} className={`${primaryBtn} mt-3 flex items-center justify-center gap-2`}>
                <Save className="h-4 w-4" /> {listed.name} dosyasına kaydet
              </button>
            )
          ) : (
            <p className="mt-3 text-center text-xs text-muted-foreground">Talebe listeden seçilirse tutanak dosyasına da kaydedilebilir.</p>
          )}
        </div>
      )}
    </>
  );
}
