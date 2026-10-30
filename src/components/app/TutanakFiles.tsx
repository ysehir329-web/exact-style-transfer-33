import { useEffect, useState } from "react";
import { Camera, FileText } from "./icons";
import { getFile } from "@/lib/attachments";

function useFileUrl(id?: string | undefined) {
  const [file, setFile] = useState<{ url: string; type: string; name: string } | null>(null);
  useEffect(() => {
    setFile(null);
    if (!id) return;
    let url = "";
    let alive = true;
    getFile(id).then((f) => {
      if (!f || !alive) return;
      url = URL.createObjectURL(f.blob);
      setFile({ url, type: f.type, name: f.name });
    }).catch(() => undefined);
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [id]);
  return file;
}

function One({ id, label, icon: Icon }: { id?: string | undefined; label: string; icon: typeof Camera }) {
  const f = useFileUrl(id);
  if (!id || !f) return null;
  return (
    <a href={f.url} target="_blank" rel="noreferrer" className="block min-w-0">
      {f.type.startsWith("image/")
        ? <img src={f.url} alt={label} className="h-auto w-full object-contain" loading="lazy" />
        : <div className="flex items-center gap-2 py-3 text-primary"><FileText className="h-6 w-6 shrink-0" /><span className="break-all text-sm">{f.name}</span></div>}
      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" /> {label}</p>
    </a>
  );
}

export function TutanakFiles({ photoId, docId }: { photoId?: string | undefined; docId?: string | undefined }) {
  if (!photoId && !docId) return null;
  return (
    <div className="mt-3 space-y-4">
      <One id={photoId} label="Fotoğraf Kanıtı" icon={Camera} />
      <One id={docId} label="İmzalı Belge" icon={FileText} />
    </div>
  );
}
