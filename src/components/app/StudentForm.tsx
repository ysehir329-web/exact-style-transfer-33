import { localIso } from "@/lib/utils";
import { useState } from "react";
import type { Student } from "@/lib/store";
import { Field, inputCls, primaryBtn } from "./Sheet";

export type StudentInput = Omit<Student, "id">;

export const emptyStudent: StudentInput = {
  name: "", age: "", group: "Daimi Grup", city: "", startDate: localIso(), guardian: "", phone: "", status: "İyi",
};

export function StudentForm({ initial, onSubmit }: { initial: StudentInput; onSubmit: (s: StudentInput) => void }) {
  const [f, setF] = useState(initial);
  const set = (k: keyof StudentInput) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (f.name.trim()) onSubmit({ ...f, name: f.name.trim() }); }}>
      <Field label="Adı Soyadı *"><input className={inputCls} value={f.name} onChange={set("name")} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Yaş"><input className={inputCls} inputMode="numeric" value={f.age} onChange={set("age")} /></Field>
        <Field label="Grup">
          <select className={inputCls} value={f.group} onChange={set("group")}>
            <option>Daimi Grup</option><option>Hafızlık</option><option>Yaz Kursu</option><option>Hafta Sonu</option>
          </select>
        </Field>
        <Field label="Şehir"><input className={inputCls} value={f.city} onChange={set("city")} /></Field>
        <Field label="Başlangıç"><input type="date" className={inputCls} value={f.startDate} onChange={set("startDate")} /></Field>
        <Field label="Veli"><input className={inputCls} value={f.guardian} onChange={set("guardian")} /></Field>
        <Field label="Telefon"><input type="tel" className={inputCls} value={f.phone} onChange={set("phone")} /></Field>
      </div>
      <Field label="Durum">
        <select className={inputCls} value={f.status} onChange={set("status")}><option>İyi</option><option>Orta</option></select>
      </Field>
      <button className={primaryBtn} disabled={!f.name.trim()}>Kaydet</button>
    </form>
  );
}
