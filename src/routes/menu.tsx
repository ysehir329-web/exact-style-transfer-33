import { localIso } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Download, Upload, FileDown, UserPlus } from "@/components/app/icons";
import { ReportSheet } from "@/components/app/ReportSheet";
import { Sheet } from "@/components/app/Sheet";
import { StudentForm, emptyStudent } from "@/components/app/StudentForm";
import { PhotoNamesImport } from "@/components/app/PhotoNamesImport";
import { useStore, type State } from "@/lib/store";
import { exportFiles, importFiles } from "@/lib/attachments";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menü — Kur'an Kursu" },
      { name: "description", content: "Kur'an kursu verilerini yedekleyin ve geri yükleyin." },
      { property: "og:title", content: "Menü — Kur'an Kursu" },
      { property: "og:description", content: "Kur'an kursu verilerini yedekleyin ve geri yükleyin." },
    ],
  }),
  component: Menu,
});

function Menu() {
  const { students, tutanaklar, attendance, importAll, addStudent } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const exportData = async () => {
    const ids = tutanaklar.flatMap((t) => [t.photoId, t.docId]).filter((x): x is string => Boolean(x));
    const files = ids.length ? await exportFiles(ids).catch(() => ({})) : {};
    const blob = new Blob([JSON.stringify({ students, tutanaklar, attendance, files }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kuran-kursu-yedek-${localIso()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importData = async (f?: File) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as State & { files?: Parameters<typeof importFiles>[0] };
      await importFiles(data.files).catch(() => undefined);
      importAll(data);
      setMsg("Yedek geri yüklendi.");
    } catch {
      setMsg("Dosya okunamadı.");
    }
  };
  const btn = "flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left text-sm";

  return (
    <>
      <h2 className="mt-7 font-serif text-3xl font-bold">Menü</h2>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[["Talebe", students.length], ["Yoklama", attendance.length], ["Tutanak", tutanaklar.length]].map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-surface p-3"><p className="font-serif text-2xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        <button onClick={() => setAddOpen(true)} className={`${btn} border-primary bg-primary text-primary-foreground`}><UserPlus className="h-5 w-5" /> Talebe Ekle</button>
        <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Yeni Talebe">
          <PhotoNamesImport onDone={(n) => { setAddOpen(false); setMsg(`${n} talebe eklendi.`); }} />
          <StudentForm initial={emptyStudent} onSubmit={(s) => { addStudent(s); setAddOpen(false); setMsg(`${s.name} eklendi.`); }} />
        </Sheet>
        <button onClick={() => setReportOpen(true)} className={btn}><FileDown className="h-5 w-5 text-primary" /> Yoklama Raporu İndir (PDF / Excel)</button>
        <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} />
        <button onClick={exportData} className={btn}><Download className="h-5 w-5 text-primary" /> Verileri Yedekle (indir)</button>
        <button onClick={() => fileRef.current?.click()} className={btn}><Upload className="h-5 w-5 text-primary" /> Yedeği Geri Yükle</button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => importData(e.target.files?.[0])} />
        {msg && <p className="text-center text-sm text-primary">{msg}</p>}
        <p className="text-center text-xs text-muted-foreground">Veriler bu cihazda saklanır.</p>
      </div>
    </>
  );
}
