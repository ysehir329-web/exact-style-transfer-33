import { X } from "./icons";
import type { ReactNode } from "react";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground" aria-label="Kapat"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputCls = "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary";
export const primaryBtn = "w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50";
