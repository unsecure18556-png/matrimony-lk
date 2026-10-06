import { useEffect, useState } from "react";
import { fetchFeed, fetchSavedPosts, type Post } from "../../services/postService";
import Icon from "../ui/Icon";

export default function PostPickerSheet({ me, onSelect, onClose }: { me: string; onSelect: (p: Post) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"mine" | "saved">("mine");
  const [mine, setMine] = useState<Post[] | null>(null);
  const [saved, setSaved] = useState<Post[] | null>(null);
  useEffect(() => { fetchFeed(me, { userId: me, limit: 24 }).then((r) => setMine(r.posts)); fetchSavedPosts(me).then(setSaved); }, [me]);
  const list = tab === "mine" ? mine : saved;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Share a post</h2>
          <button aria-label="Close" onClick={onClose}><Icon name="x" size={22} /></button></div>
        <div className="mb-3 flex gap-2">
          {(["mine", "saved"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-brand-600 text-white" : "bg-stone-100"}`}>{t === "mine" ? "My posts" : "Saved"}</button>)}
        </div>
        {list === null ? <p className="py-8 text-center text-sm text-stone-500">Loading...</p> : list.length === 0 ? <p className="py-8 text-center text-sm text-stone-500">No posts here yet.</p> : (
          <div className="grid grid-cols-3 gap-1.5">
            {list.map((p) => <button key={p.id} onClick={() => onSelect(p)} className="aspect-square overflow-hidden rounded-lg bg-stone-200">{p.images[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}
