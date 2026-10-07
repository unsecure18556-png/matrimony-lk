import { useCallback, useEffect, useRef, useState } from "react";
import {
  deletePhoto, listPhotos, setPrimaryPhoto, uploadPhoto, type Photo,
} from "../../services/profileService";

const MAX_PHOTOS = 6;

export default function PhotoManager({
  uid, onCount,
}: { uid: string; onCount?: (n: number) => void }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const list = await listPhotos(uid);
    setPhotos(list);
    onCount?.(list.length);
  }, [uid, onCount]);

  useEffect(() => { load(); }, [load]);

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setBusy(true);
    try {
      let count = photos.length;
      for (const f of Array.from(files)) {
        if (count >= MAX_PHOTOS) break;
        if (!f.type.startsWith("image/")) continue;
        await uploadPhoto(uid, f, count === 0);
        count++;
      }
      await load();
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-3 gap-3">
        {photos.map((p) => (
          <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg border">
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            {p.is_primary && (
              <span className="absolute left-1 top-1 rounded bg-brand-600 px-2 text-xs text-white">Main</span>
            )}
            <div className="absolute bottom-0 flex w-full justify-between bg-black/50 px-1 text-xs text-white">
              {!p.is_primary ? (
                <button onClick={async () => { await setPrimaryPhoto(uid, p.id); load(); }}>Make main</button>
              ) : <span />}
              <button onClick={async () => { await deletePhoto(uid, p); load(); }}>Delete</button>
            </div>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button" disabled={busy} onClick={() => fileRef.current?.click()}
            className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed text-sm text-gray-500 hover:bg-gray-50"
          >
            {busy ? "Uploading..." : "+ Add photo"}
          </button>
        )}
      </div>
      <input
        ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={(e) => onPick(e.target.files)}
      />
      <p className="text-xs text-gray-500">
        Up to {MAX_PHOTOS} photos. Use clear, recent photos of the candidate only.
      </p>
    </div>
  );
}
