import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, User, GraduationCap, Users } from "@/components/app/icons";
import { Avatar } from "@/components/app/AppShell";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Talebeler — Kur'an Kursu" },
      { name: "description", content: "Kur'an kursu talebe listesi ve durum takibi." },
      { property: "og:title", content: "Talebeler — Kur'an Kursu" },
      { property: "og:description", content: "Kur'an kursu talebe listesi ve durum takibi." },
    ],
  }),
  component: Index,
});

function Index() {
  const { students } = useStore();
  const [q, setQ] = useState("");
  const list = students.filter((s) => s.name.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")));
  return (
    <>
      <div className="mt-7 flex items-center justify-between">
        <h2 className="font-serif text-2xl font-bold">Talebeler</h2>
        <span className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm">
          <User className="h-4 w-4" /> {students.length}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-surface px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Talebe ara..." className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </div>
      {students.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-serif text-lg font-bold">Henüz talebe yok</p>
          <p className="mt-1 text-sm text-muted-foreground">Talebe eklemek için Menü'deki "Talebe Ekle" düğmesini kullanın.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between rounded-t-lg bg-brand-soft px-5 py-2.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><User className="h-4 w-4" /> Adı Soyadı</span>
            <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Durum</span>
          </div>
          <div className="overflow-hidden rounded-b-2xl border border-t-0 border-border bg-card">
            {list.map((s, i) => (
              <Link key={s.id} to="/talebe/$name" params={{ name: s.id }} className="flex items-center gap-4 border-b border-border px-5 py-3 last:border-0">
                <span className="w-4 text-sm text-muted-foreground">{i + 1}</span>
                <Avatar name={s.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-base font-bold">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.group || "Talebe"}</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm">
                  <span className={`h-1.5 w-1.5 rounded-full ${s.status === "İyi" ? "bg-good" : "bg-warn"}`} />
                  {s.status}
                </span>
              </Link>
            ))}
            {list.length === 0 && <p className="p-5 text-center text-sm text-muted-foreground">Sonuç yok.</p>}
          </div>
        </>
      )}
    </>
  );
}
