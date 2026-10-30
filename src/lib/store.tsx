import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Student = {
  id: string;
  name: string;
  age: string;
  group: string;
  city: string;
  startDate: string;
  guardian: string;
  phone: string;
  status: "İyi" | "Orta";
};

export type Tutanak = {
  id: string;
  studentId: string;
  title: string;
  tag: string;
  date: string;
  body: string;
  positive: boolean;
  signed: boolean;
  /** Attachment ids in IndexedDB (see attachments.ts). */
  photoId?: string | undefined;
  docId?: string | undefined;
  /** Student portrait shown top-right of the tutanak. */
  studentPhotoId?: string | undefined;
};

export type AttendanceRow = {
  id: string;
  studentId: string;
  date: string;
  vakitler: string[];
  ders: boolean;
  durum: "normal" | "izinli" | "gec";
};

type Store = {
  students: Student[];
  tutanaklar: Tutanak[];
  attendance: AttendanceRow[];
  addStudent: (s: Omit<Student, "id">) => void;
  updateStudent: (id: string, s: Partial<Student>) => void;
  removeStudent: (id: string) => void;
  addTutanak: (t: Omit<Tutanak, "id">) => void;
  removeTutanak: (id: string) => void;
  addAttendance: (a: Omit<AttendanceRow, "id">) => void;
  removeAttendance: (id: string) => void;
  updateTutanak: (id: string, t: Partial<Tutanak>) => void;
  saveDay: (date: string, rows: Omit<AttendanceRow, "id" | "date">[]) => void;
  importAll: (s: State) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);

const KEY = "kuran-kursu-store-v2";

export type State = { students: Student[]; tutanaklar: Tutanak[]; attendance: AttendanceRow[] };

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<State>;
      return { students: s.students ?? [], tutanaklar: s.tutanaklar ?? [], attendance: s.attendance ?? [] };
    }
  } catch {
    /* ignore */
  }
  return { students: [], tutanaklar: [], attendance: [] };
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ students: [], tutanaklar: [], attendance: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Veriler kaydedilemedi", e);
      alert("Veriler kaydedilemedi: cihaz hafızası dolu olabilir. Lütfen Menü'den yedek alın.");
    }
  }, [state, ready]);

  const store: Store = {
    ...state,
    addStudent: (s) => setState((p) => ({ ...p, students: [...p.students, { ...s, id: uid() }] })),
    updateStudent: (id, s) => setState((p) => ({ ...p, students: p.students.map((x) => (x.id === id ? { ...x, ...s } : x)) })),
    removeStudent: (id) =>
      setState((p) => ({
        students: p.students.filter((x) => x.id !== id),
        tutanaklar: p.tutanaklar.filter((x) => x.studentId !== id),
        attendance: p.attendance.filter((x) => x.studentId !== id),
      })),
    addTutanak: (t) => setState((p) => ({ ...p, tutanaklar: [...p.tutanaklar, { ...t, id: uid() }] })),
    removeTutanak: (id) => setState((p) => ({ ...p, tutanaklar: p.tutanaklar.filter((x) => x.id !== id) })),
    addAttendance: (a) => setState((p) => ({ ...p, attendance: [...p.attendance, { ...a, id: uid() }] })),
    removeAttendance: (id) => setState((p) => ({ ...p, attendance: p.attendance.filter((x) => x.id !== id) })),
    updateTutanak: (id, t) => setState((p) => ({ ...p, tutanaklar: p.tutanaklar.map((x) => (x.id === id ? { ...x, ...t } : x)) })),
    saveDay: (date, rows) =>
      setState((p) => {
        const ids = new Set(rows.map((r) => r.studentId));
        return {
          ...p,
          attendance: [
            ...p.attendance.filter((x) => !(x.date === date && ids.has(x.studentId))),
            ...rows.map((r) => ({ ...r, date, id: uid() })),
          ],
        };
      }),
    importAll: (s) => setState({ students: s.students ?? [], tutanaklar: s.tutanaklar ?? [], attendance: s.attendance ?? [] }),
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
