import { useEffect, useRef, useState } from "react";
import { FileDown, Loader2 } from "./icons";
import { deliverFile } from "@/lib/report-export";

type Made = { blob: Blob; name: string };

/**
 * Builds the PDF before the tap that saves it, because iPhones only allow saving/sharing
 * directly inside a tap. With `auto` it prepares in the background whenever `depsKey` changes.
 */
export function PdfButton({ make, depsKey, auto = false, label, readyLabel, className }: {
  make: () => Promise<Made>;
  depsKey: string;
  auto?: boolean;
  label: string;
  readyLabel?: string;
  className: string;
}) {
  const [state, setState] = useState<{ s: "idle" | "busy" | "ready" | "error"; file?: Made | undefined }>({ s: "idle" });
  const makeRef = useRef(make);
  makeRef.current = make;
  const run = useRef(0);

  const prepare = async () => {
    const id = ++run.current;
    // Keep the last finished PDF downloadable while a fresh one is built.
    setState((p) => ({ s: "busy", file: p.file }));
    try {
      const file = await makeRef.current();
      if (id === run.current) setState({ s: "ready", file });
      return file;
    } catch (e) {
      console.error("PDF failed", e);
      if (id === run.current) setState((p) => (p.file ? { s: "ready", file: p.file } : { s: "error" }));
      return null;
    }
  };

  useEffect(() => {
    if (!auto) { run.current++; setState({ s: "idle" }); return; }
    const t = setTimeout(() => void prepare(), 250);
    return () => { clearTimeout(t); run.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, auto]);

  const onClick = async () => {
    if (state.file && (state.s === "ready" || auto)) { void deliverFile(state.file.blob, state.file.name); return; }
    if (state.s === "busy") return;
    const file = await prepare();
    // Desktop browsers can save right away; phones need one more tap on "ready".
    if (file && !matchMedia("(pointer: coarse)").matches) void deliverFile(file.blob, file.name);
  };

  const has = auto && !!state.file;
  const text = has ? (readyLabel ?? "PDF İndir") : state.s === "busy" ? "PDF hazırlanıyor…" : state.s === "error" ? "Tekrar dene" : state.s === "ready" && !auto ? (readyLabel ?? "PDF hazır — Aç") : label;
  return (
    <button type="button" onClick={onClick} disabled={state.s === "busy" && auto && !state.file} className={className}>
      {state.s === "busy" && !has ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {text}
    </button>
  );
}
