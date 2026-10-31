import { localIso } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "./icons";
import { Sheet, Field, inputCls, primaryBtn } from "./Sheet";
import { useStore } from "@/lib/store";
import { PERIODS, buildChart, buildReport, filterRows, periodRange, rangeLabel, type Period } from "@/lib/report";
import { deliverFile, makePdf, makeXlsx } from "@/lib/report-export";

type Format = "pdf" | "xlsx";

export function ReportSheet({ open, onClose, initialDate, studentId: initialStudent = "" }: { open: boolean; onClose: () => void; initialDate?: string; studentId?: string }) {
  const { students, attendance } = useStore();
  const [period, setPeriod] = useState<Period>("aylik");
  const [date, setDate] = useState(initialDate ?? localIso());
  const [studentId, setStudentId] = useState(initialStudent);
  const [format, setFormat] = useState<Format>("pdf");
  const [file, setFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (initialDate) setDate(initialDate);
      setStudentId(initialStudent);
    }
  }, [open, initialDate, initialStudent]);

  const scoped = useMemo(() => (studentId ? attendance.filter((r) => r.studentId === studentId) : attendance), [attendance, studentId]);
  const range = useMemo(() => periodRange(period, date, scoped), [period, date, scoped]);
  const rows = useMemo(() => filterRows(scoped, range), [scoped, range]);
  const studentName = students.find((s) => s.id === studentId)?.name;
  const periodLabel = PERIODS.find((p) => p.key === period)!.label;

  // Prepare the file ahead of the tap so the download starts instantly (and works on iPhone).
  useEffect(() => {
    if (!open || rows.length === 0) {
      setFile(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError("");
    setFile(null);
    const t = setTimeout(async () => {
      try {
        const report = buildReport(students, rows);
        const title = `${periodLabel} Yoklama Raporu${studentName ? ` — ${studentName}` : ""}`;
        const fileBase = `yoklama-${period}-${range.start}${range.end !== range.start ? `_${range.end}` : ""}${studentName ? `-${studentName.toLocaleLowerCase("tr").replace(/\s+/g, "-")}` : ""}`;
        const chart = buildChart(studentId ? students.filter((s) => s.id === studentId) : students, rows);
        const input = { report, chart, title, rangeText: rangeLabel(range), fileBase };
        const blob = format === "pdf" ? await makePdf(input) : await makeXlsx(input);
        if (!cancelled) setFile({ blob, name: `${fileBase}.${format}` });
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Rapor hazırlanamadı, lütfen tekrar deneyin.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, rows, students, studentId, format, period, periodLabel, range, studentName]);

  const download = () => {
    if (file) void deliverFile(file.blob, file.name);
  };

  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-xs transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground"}`;

  return (
    <Sheet open={open} onClose={onClose} title="Yoklama Raporu İndir">
      <Field label="Dönem">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" onClick={() => setPeriod(p.key)} className={chip(period === p.key)}>{p.label}</button>
          ))}
        </div>
      </Field>
      {period !== "tumu" && (
        <Field label={period === "gunluk" ? "Gün" : "Bu tarihi içeren dönem"}>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputCls} />
        </Field>
      )}
      <Field label="Talebe">
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputCls}>
          <option value="">Tüm talebeler</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Biçim">
        <div className="grid grid-cols-2 gap-2">
          {([["pdf", "PDF", FileText], ["xlsx", "Excel", FileSpreadsheet]] as const).map(([k, l, Icon]) => (
            <button key={k} type="button" onClick={() => setFormat(k)} className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm transition-colors ${format === k ? "border-primary bg-brand-soft font-medium text-primary" : "border-border bg-surface text-muted-foreground"}`}>
              <Icon className="h-4 w-4" /> {l}
            </button>
          ))}
        </div>
      </Field>

      <div className="mb-4 rounded-xl bg-surface p-3 text-sm">
        <p className="font-medium">{rangeLabel(range)}</p>
        <p className="text-xs text-muted-foreground">
          {rows.length ? `${rows.length} yoklama kaydı bulundu.` : "Bu dönemde kaydedilmiş yoklama yok."}
        </p>
      </div>

      {error && <p className="mb-3 text-center text-sm text-destructive">{error}</p>}
      <button onClick={download} disabled={!file || busy} className={`${primaryBtn} flex items-center justify-center gap-2`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? "Hazırlanıyor…" : `${format === "pdf" ? "PDF" : "Excel"} olarak indir`}
      </button>
    </Sheet>
  );
}

