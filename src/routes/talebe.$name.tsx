import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, Pencil, Trash2, MapPin, User, Phone, Plus,
  CalendarDays, Clock, CalendarOff, Sunrise, Sun, CloudSun, Sunset, Moon,
  CheckCircle2, CalendarX, AlertTriangle, PenLine, ThumbsUp,
} from "@/components/app/icons";
import { Avatar } from "@/components/app/AppShell";
import { Sheet } from "@/components/app/Sheet";
import { StudentForm } from "@/components/app/StudentForm";
import { TutanakForm } from "@/components/app/TutanakForm";
import { TutanakFiles } from "@/components/app/TutanakFiles";
import { deleteFile } from "@/lib/attachments";
import { useStore, type Student, type Tutanak } from "@/lib/store";
import { PdfButton } from "@/components/app/PdfButton";
import { computeStats, monthly, VAKITLER } from "@/lib/stats";

export const Route = createFileRoute("/talebe/$name")({
  head: () => ({
    meta: [
      { title: "Talebe Detayı — Kur'an Kursu" },
      { name: "description", content: "Talebe detayı: yoklama özeti, tutanaklar ve aile raporu." },
      { property: "og:title", content: "Talebe Detayı — Kur'an Kursu" },
      { property: "og:description", content: "Talebe detayı: yoklama özeti, tutanaklar ve aile raporu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TalebeDetay,
});

const tabs = ["Yoklama", "Tutanaklar", "Aile Raporu"] as const;
const vakitIcons = { Sabah: Sunrise, Öğle: Sun, İkindi: CloudSun, Akşam: Sunset, Yatsı: Moon } as Record<string, typeof Clock>;
function TutCard({ t, student, onSign, onRemove }: { t: Tutanak; student: Student; onSign?: () => void; onRemove?: () => void }) {
  return (
    <div className="border-b border-border py-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${t.positive ? "bg-brand-soft" : "bg-amber-soft"}`}>
          {t.positive ? <ThumbsUp className="h-5 w-5 text-good" /> : <AlertTriangle className="h-5 w-5 text-warn" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t.title}</p>
          <p className="text-xs text-muted-foreground">{t.date}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-3 py-1 text-xs ${t.positive ? "bg-good text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>{t.tag}</span>
          {onSign ? (
            <button onClick={onSign} className={`flex items-center gap-1 text-xs ${t.signed ? "text-good" : "text-muted-foreground"}`}>
              <PenLine className="h-3.5 w-3.5" /> {t.signed ? "İmzalı" : "İmzala"}
            </button>
          ) : (
            <span className={`text-xs ${t.signed ? "text-good" : "text-muted-foreground"}`}>{t.signed ? "Veli imzalı" : "İmza bekliyor"}</span>
          )}
        </div>
      </div>
      {t.body && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{t.body}</p>}
      <TutanakFiles photoId={t.photoId} docId={t.docId} />
      <div className="mt-3 flex items-center justify-between gap-2">
        <PdfButton
          make={() => import("@/lib/student-pdf").then((m) => m.makeTutanakPdf(student, t))}
          depsKey={JSON.stringify([t, student])}
          label="Tutanak PDF"
          className="flex items-center gap-1.5 rounded-xl bg-brand-soft px-3 py-2 text-xs font-medium text-primary"
        />
        {onRemove && <button onClick={onRemove} className="flex items-center gap-1 text-xs text-destructive"><Trash2 className="h-3.5 w-3.5" /> Sil</button>}
      </div>
    </div>
  );
}

function TalebeDetay() {
  const { name: raw } = Route.useParams();
  const store = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Yoklama");
  const [sheet, setSheet] = useState<null | "edit" | "tutanak">(null);
  const found = store.students.find((s) => s.id === raw) ?? store.students.find((s) => s.name === decodeURIComponent(raw));
  const student = found;
  const id = found?.id ?? raw;

  if (!student) {
    return (
      <>
        <Link to="/" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Talebeler</Link>
        <p className="mt-10 text-center text-muted-foreground">Talebe bulunamadı.</p>
      </>
    );
  }

  const rows = store.attendance.filter((a) => a.studentId === id).sort((a, b) => b.date.localeCompare(a.date));
  const tut = store.tutanaklar.filter((t) => t.studentId === id).sort((a, b) => b.date.localeCompare(a.date));
  const st = computeStats(rows);
  const months = monthly(rows);

  const remove = () => {
    if (confirm(`${student.name} ve tüm kayıtları silinsin mi?`)) { tut.forEach((t) => { if (t.photoId) deleteFile(t.photoId); if (t.docId) deleteFile(t.docId); }); store.removeStudent(id); navigate({ to: "/" }); }
  };

  const removeTut = (t: Tutanak) => {
    if (!confirm("Tutanak silinsin mi?")) return;
    store.removeTutanak(t.id);
    if (t.photoId) deleteFile(t.photoId);
    if (t.docId) deleteFile(t.docId);
  };

  const pos = tut.filter((t) => t.positive);
  const neg = tut.filter((t) => !t.positive);

  return (
    <>
      <Link to="/" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground print:hidden">
        <ArrowLeft className="h-4 w-4" /> Talebeler
      </Link>

      <div className="mt-3 rounded-2xl border border-border bg-card p-4 print:hidden">
        <div className="flex items-center gap-3">
          <Avatar name={student.name} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-serif text-2xl font-bold leading-tight">{student.name}</h2>
            <p className="text-sm text-muted-foreground">
              {[student.age && `${student.age} yaş`, student.group].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={() => setSheet("edit")} className="rounded-xl border border-border p-2" aria-label="Düzenle"><Pencil className="h-4 w-4" /></button>
          <button onClick={remove} className="rounded-xl p-2 text-destructive" aria-label="Sil"><Trash2 className="h-4 w-4" /></button>
        </div>
        {(student.guardian || student.phone || student.city) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
            {student.guardian && <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> {student.guardian}</span>}
            {student.phone && <a href={`tel:${student.phone}`} className="flex items-center gap-1.5 text-primary"><Phone className="h-4 w-4" /> {student.phone}</a>}
            {student.city && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {student.city}</span>}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1.5 print:hidden">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-xl py-2 text-sm ${tab === t ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "Yoklama" && (
        <>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              { l: "Toplam", v: st.toplam, c: "text-foreground" },
              { l: "Ders", v: st.ders, c: "text-primary" },
              { l: "Geç", v: st.gec, c: "text-warn" },
              { l: "İzinli", v: st.izinli, c: "text-info" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-surface py-3">
                <p className={`font-serif text-2xl font-bold ${s.c}`}>{s.v}</p>
                <p className="text-xs text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between rounded-2xl bg-surface px-3 py-3">
            {VAKITLER.map((v) => {
              const Icon = vakitIcons[v] ?? Clock;
              return (
                <div key={v} className="flex flex-1 flex-col items-center">
                  <Icon className="h-4 w-4 text-good" />
                  <p className="mt-1 font-serif text-lg font-bold">{st.vakit[v] ?? 0}</p>
                  <p className="text-[11px] text-muted-foreground">{v}</p>
                </div>
              );
            })}
          </div>

          {months.length > 0 && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <h4 className="font-serif text-lg font-bold">Aylık Gelişim</h4>
              <div className="mt-3 flex h-28 items-end gap-4 border-b border-border px-2">
                {months.map((m) => (
                  <div key={m.key} className="flex h-full flex-1 items-end justify-center gap-1.5">
                    <div className="w-5 rounded-t-lg bg-good" style={{ height: `${Math.max(m.namaz, 2)}%` }} title={`Namaz %${m.namaz}`} />
                    <div className="w-5 rounded-t-lg bg-warn" style={{ height: `${Math.max(m.ders, 2)}%` }} title={`Ders %${m.ders}`} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-4 px-2 text-xs text-muted-foreground">{months.map((m) => <span key={m.key} className="flex-1 text-center">{m.ay}</span>)}</div>
              <div className="mt-2 flex justify-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-good" /> Namaz %</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warn" /> Ders %</span>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "Tutanaklar" && (
        <>
          <div className="mt-6 flex items-start justify-between gap-3">
            <h3 className="font-serif text-2xl font-bold leading-tight">Tutanaklar & Davranış Kayıtları</h3>
            <button onClick={() => setSheet("tutanak")} className="flex shrink-0 items-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm text-destructive-foreground"><Plus className="h-4 w-4" /> Tutanak Ekle</button>
          </div>
          <h4 className="mt-5 font-serif text-lg font-bold text-primary">Olumlu ({pos.length})</h4>
          <div className="mt-3 space-y-4">{pos.length ? pos.map((t) => <TutCard key={t.id} t={t} student={student} onSign={() => store.updateTutanak(t.id, { signed: !t.signed })} onRemove={() => removeTut(t)} />) : <p className="text-sm text-muted-foreground">Kayıt yok.</p>}</div>
          <h4 className="mt-5 font-serif text-lg font-bold text-warn">Olumsuz ({neg.length})</h4>
          <div className="mt-3 space-y-4">{neg.length ? neg.map((t) => <TutCard key={t.id} t={t} student={student} onSign={() => store.updateTutanak(t.id, { signed: !t.signed })} onRemove={() => removeTut(t)} />) : <p className="text-sm text-muted-foreground">Kayıt yok.</p>}</div>
        </>
      )}

      {tab === "Aile Raporu" && (
        <>
          <div className="mt-6 flex items-center justify-between print:hidden">
            <h3 className="font-serif text-2xl font-bold">Aile Raporu</h3>
            <PdfButton
              auto
              make={() => import("@/lib/student-pdf").then((m) => m.makeStudentPdf(student, rows, tut))}
              depsKey={JSON.stringify([student, rows, tut])}
              label="PDF İndir"
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-70"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">PDF; yoklama özeti, tüm tutanaklar, fotoğraflar ve imzalı belgeleri içerir.</p>
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              <Avatar name={student.name} />
              <div>
                <p className="font-serif text-xl font-bold">{student.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {student.age && <span>{student.age} yaş</span>}
                  {student.group && <span className="rounded-full bg-amber-soft px-2.5 py-0.5 text-xs font-medium text-warn">{student.group}</span>}
                  {student.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {student.city}</span>}
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-y-6 border-t border-border pt-5 text-center">
              {[
                { icon: CheckCircle2, v: st.namazGun, l: "Namaza Katıldığı", c: "text-good" },
                { icon: CheckCircle2, v: st.ders, l: "Derse Girdiği", c: "text-good" },
                { icon: Clock, v: st.gec, l: "Geç Kaldığı", c: "text-warn" },
                { icon: CalendarX, v: st.katilmadi, l: "Katılmadığı", c: "text-destructive" },
                { icon: CalendarOff, v: st.izinli, l: "İzinli Gün", c: "text-info" },
                { icon: CalendarDays, v: st.toplam, l: "Toplam Gün", c: "text-muted-foreground" },
              ].map((s) => (
                <div key={s.l}>
                  <s.icon className={`mx-auto h-7 w-7 ${s.c}`} />
                  <p className="mt-1 font-serif text-2xl font-bold">{s.v}</p>
                  <p className="text-xs text-muted-foreground">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
          <h4 className="mt-6 font-serif text-lg font-bold">Tutanaklar ({tut.length})</h4>
          <div className="mt-3 space-y-4">
            {tut.length ? tut.map((t) => <TutCard key={t.id} t={t} student={student} />) : <p className="text-sm text-muted-foreground">Kayıtlı tutanak yok.</p>}
          </div>
        </>
      )}

      <Sheet open={sheet === "edit"} onClose={() => setSheet(null)} title="Talebeyi Düzenle">
        <StudentForm initial={student} onSubmit={(s) => { store.updateStudent(id, s); setSheet(null); }} />
      </Sheet>
      <Sheet open={sheet === "tutanak"} onClose={() => setSheet(null)} title="Yeni Tutanak">
        <TutanakForm onCancel={() => setSheet(null)} onSubmit={(t) => { store.addTutanak({ ...t, studentId: id }); setSheet(null); }} />
      </Sheet>
    </>
  );
}
