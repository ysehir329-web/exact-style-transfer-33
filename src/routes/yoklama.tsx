import { localIso } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Save, Check } from "@/components/app/icons";
import { Avatar } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { useStore, type AttendanceRow } from "@/lib/store";
import { VAKITLER } from "@/lib/stats";

export const Route = createFileRoute("/yoklama")({
  head: () => ({
    meta: [
      { title: "Günlük Yoklama — Kur'an Kursu" },
      { name: "description", content: "Beş vakit namaz ve ders yoklamasını işaretleyip kaydedin." },
      { property: "og:title", content: "Günlük Yoklama — Kur'an Kursu" },
      { property: "og:description", content: "Beş vakit namaz ve ders yoklamasını işaretleyip kaydedin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Yoklama,
});

const cols = [...VAKITLER, "Ders"];
const DURUMLAR = [
  { k: "gec", l: "Geç" },
  { k: "izinli", l: "İzinli" },
] as const;
type Row = { vakitler: string[]; ders: boolean; durum: AttendanceRow["durum"] };

function Yoklama() {
  const { students, attendance, saveDay } = useStore();
  const [date, setDate] = useState(localIso());
  const [marks, setMarks] = useState<Record<string, Row>>({});
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<"hepsi" | "tek">("hepsi");
  const [tek, setTek] = useState<string>(VAKITLER[0]);

  // attendance arrives one tick after mount (store hydrates from device storage),
  // so this must re-run when it loads — otherwise saved marks never show up.
  useEffect(() => {
    const m: Record<string, Row> = {};
    for (const a of attendance.filter((x) => x.date === date)) m[a.studentId] = { vakitler: a.vakitler, ders: a.ders, durum: a.durum };
    setMarks(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, attendance]);

  const d = new Date(date + "T12:00");
  const label = d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  const day = d.toLocaleDateString("tr-TR", { weekday: "long" });
  const get = (id: string): Row => marks[id] ?? { vakitler: [], ders: false, durum: "normal" };

  const toggle = (id: string, c: string) => {
    const r = get(id);
    const next = c === "Ders" ? { ...r, ders: !r.ders } : { ...r, vakitler: r.vakitler.includes(c) ? r.vakitler.filter((v) => v !== c) : [...r.vakitler, c] };
    setMarks({ ...marks, [id]: next });
    setSaved(false);
  };
  const setDurum = (id: string, durum: Row["durum"]) => { setMarks({ ...marks, [id]: { ...get(id), durum } }); setSaved(false); };
  const toggleDurum = (id: string, k: "gec" | "izinli") => { const cur = get(id).durum; setDurum(id, cur === k ? "normal" : k); };

  const isOn = (r: Row, c: string) => (c === "Ders" ? r.ders : r.vakitler.includes(c));
  const markAll = () => {
    const allOn = students.every((s) => isOn(get(s.id), tek));
    const m = { ...marks };
    for (const s of students) {
      const r = get(s.id);
      if (isOn(r, tek) === allOn) m[s.id] = tek === "Ders" ? { ...r, ders: !allOn } : { ...r, vakitler: allOn ? r.vakitler.filter((v) => v !== tek) : [...r.vakitler, tek] };
    }
    setMarks(m); setSaved(false);
  };
  const tekCount = students.filter((s) => isOn(get(s.id), tek)).length;

  const save = () => {
    saveDay(date, students.map((s) => ({ studentId: s.id, ...get(s.id) })));
    setSaved(true);
  };

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-2">
        <h2 className="font-serif text-2xl font-bold">Günlük Yoklama</h2>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="relative flex min-w-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs" title={day}>
          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>{label} <span className="hidden text-muted-foreground sm:inline">· {day}</span></span>
          <input aria-label="Yoklama tarihi" type="date" value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setSaved(false); } }} className="absolute inset-0 w-full opacity-0" />
        </label>
        <Button onClick={save} disabled={!students.length} size="sm" className="shrink-0">
          {saved ? <Check /> : <Save />} {saved ? "Kaydedildi" : "Yoklamayı Kaydet"}
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-surface p-1 text-sm">
        {([["hepsi", "Tüm Vakitler"], ["tek", "Tek Namaz"]] as const).map(([k, l]) => (
          <Button key={k} variant="ghost" size="sm" onClick={() => setMode(k)} aria-pressed={mode === k} className={mode === k ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-muted-foreground"}>{l}</Button>
        ))}
      </div>
      {mode === "tek" && (
        <div className="mt-2 grid grid-cols-6 gap-1">
          {cols.map((c) => (
            <Button key={c} variant="outline" size="sm" onClick={() => setTek(c)} aria-pressed={tek === c} className={`px-0 ${tek === c ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "border-border bg-card text-foreground"}`}>{c}</Button>
          ))}
        </div>
      )}
      {students.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Yoklama almak için önce <Link to="/" className="font-medium text-primary underline">talebe ekleyin</Link>.
        </div>
      ) : mode === "tek" ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between gap-2 bg-brand-soft px-4 py-3">
            <span className="text-sm font-semibold">{tek} <span className="font-normal text-muted-foreground">· {tekCount}/{students.length} geldi</span></span>
            <button onClick={markAll} className="rounded-lg border border-primary/30 bg-card px-3 py-1.5 text-xs font-medium text-primary">
              {students.every((s) => isOn(get(s.id), tek)) ? "Hepsini Kaldır" : "Hepsi Geldi"}
            </button>
          </div>
          {students.map((s) => {
            const r = get(s.id);
            const on = isOn(r, tek);
            return (
              <div key={s.id} className="flex items-center gap-3 border-t border-border px-4 py-3">
                <Avatar name={s.name} size="xs" />
                <span className="min-w-0 flex-1 text-sm leading-snug">{s.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggle(s.id, tek)}
                  aria-label={`${s.name} ${tek}`}
                  aria-pressed={on}
                  className={`h-8 w-8 shrink-0 rounded-md border ${on ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "border-border bg-surface text-muted-foreground"}`}
                >
                  {on && <Check />}
                </Button>
                {DURUMLAR.map((d) => (
                  <Button
                    key={d.k}
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleDurum(s.id, d.k)}
                    aria-label={`${s.name} ${d.l}`}
                    aria-pressed={r.durum === d.k}
                    className={`h-8 w-11 shrink-0 rounded-md border px-0 text-[11px] ${r.durum === d.k ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "border-border bg-surface text-muted-foreground"}`}
                  >
                    {d.l}
                  </Button>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-2 bg-brand-soft px-3 py-2 text-muted-foreground">
            <span className="min-w-0 flex-1 text-[11px] font-semibold">Adı Soyadı</span>
            <div className="flex shrink-0 items-center gap-[3px]">
              {cols.map((c) => <span key={c} className="w-6 text-center text-[8px] leading-none tracking-tight">{c}</span>)}
              <span className="h-4 w-px shrink-0 bg-primary/20" />
              {DURUMLAR.map((d) => <span key={d.k} className="w-8 text-center text-[8px] leading-none tracking-tight">{d.l}</span>)}
            </div>
          </div>
          {students.map((s) => {
            const r = get(s.id);
            return (
              <div key={s.id} className="flex items-center gap-2 border-t border-border px-3 py-2.5">
                <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex"><Avatar name={s.name} size="xs" /><span className="min-w-0 flex-1 text-xs leading-snug">{s.name}</span></div>
                <span className="min-w-0 flex-1 text-xs leading-snug sm:hidden">{s.name}</span>
                <div className="flex shrink-0 items-center gap-[3px]">
                  {cols.map((c) => {
                    const on = c === "Ders" ? r.ders : r.vakitler.includes(c);
                    return (
                      <button
                        key={c}
                        onClick={() => toggle(s.id, c)}
                        aria-label={`${s.name} ${c}`}
                        className={`flex h-7 w-6 shrink-0 items-center justify-center rounded-md border border-border transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-surface"}`}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                  <span className="h-5 w-px shrink-0 bg-border" />
                  {DURUMLAR.map((d) => (
                    <button
                      key={d.k}
                      onClick={() => toggleDurum(s.id, d.k)}
                      aria-label={`${s.name} ${d.l}`}
                      className={`flex h-7 w-8 shrink-0 items-center justify-center rounded-md border border-border text-[8px] leading-none tracking-tight transition-colors ${r.durum === d.k ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground"}`}
                    >
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
