import Icon, { type IconName } from "../ui/Icon";

export type AttachKind = "photo" | "camera" | "video" | "post";

export default function AttachSheet({ onPick, onClose }: { onPick: (k: AttachKind) => void; onClose: () => void }) {
  const items: [AttachKind, IconName, string][] = [["photo", "image", "Photo"], ["camera", "camera", "Camera"], ["video", "video", "Video"], ["post", "grid", "Post"]];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Share</h2>
          <button aria-label="Close" onClick={onClose}><Icon name="x" size={22} /></button></div>
        <div className="grid grid-cols-4 gap-3 text-center text-xs">
          {items.map(([k, icon, label]) => (
            <button key={k} onClick={() => onPick(k)} className="flex flex-col items-center gap-2">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Icon name={icon} size={24} /></span>{label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px] text-stone-500">Links can only be shared from verified websites.</p>
      </div>
    </div>
  );
}
