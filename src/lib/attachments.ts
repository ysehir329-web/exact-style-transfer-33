// Tutanak attachments (photo evidence, signed document) live in IndexedDB, not localStorage,
// because localStorage only holds ~5 MB and photos would fill it quickly.
const DB = "kuran-kursu-files";
const STORE = "files";

export type StoredFile = { name: string; type: string; blob: Blob };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const putFile = (id: string, f: StoredFile) => tx("readwrite", (s) => s.put(f, id));
export const getFile = (id: string) => tx<StoredFile | undefined>("readonly", (s) => s.get(id));
export const deleteFile = (id: string) => tx("readwrite", (s) => s.delete(id)).catch(() => undefined);
export const listFileIds = () => tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());

export const newFileId = () => `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Shrinks photos to max 1600px JPEG so many tutanaks fit on the phone. Non-images pass through. */
export async function prepareFile(file: File): Promise<StoredFile> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return { name: file.name, type: file.type, blob: file };
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
    if (!blob) throw new Error("toBlob failed");
    return { name: file.name.replace(/\.\w+$/, "") + ".jpg", type: "image/jpeg", blob };
  } catch {
    return { name: file.name, type: file.type, blob: file };
  }
}

const toDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

/** For backups: every stored file as a data URL. */
export async function exportFiles(ids: string[]) {
  const out: Record<string, { name: string; type: string; data: string }> = {};
  for (const id of ids) {
    const f = await getFile(id).catch(() => undefined);
    if (f) out[id] = { name: f.name, type: f.type, data: await toDataUrl(f.blob) };
  }
  return out;
}

export async function importFiles(files: Record<string, { name: string; type: string; data: string }> | undefined) {
  if (!files) return;
  for (const [id, f] of Object.entries(files)) {
    const blob = await (await fetch(f.data)).blob();
    await putFile(id, { name: f.name, type: f.type, blob });
  }
}
