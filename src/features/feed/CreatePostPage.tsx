import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createPost, extractHashtags, type Visibility } from "../../services/postService";
import Icon from "../../components/ui/Icon";
import { btnPrimary, input, panel } from "../../components/ui/styles";
import { DISTRICTS } from "../../utils/constants";
import Toggle from "../../components/ui/Toggle";

const MAX = 4;

export default function CreatePostPage() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [place, setPlace] = useState("");
  const [district, setDistrict] = useState(profile?.district ?? "");
  const [visibility, setVisibility] = useState<Visibility>("members");
  const [allowComments, setAllowComments] = useState(true);
  const [showLikes, setShowLikes] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const tags = useMemo(() => extractHashtags(caption), [caption]);

  if (!user || !profile) return null;

  function pick(list: FileList | null) {
    if (!list) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((old) => [...old, ...imgs].slice(0, MAX));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    setErr("");
    if (files.length === 0) return setErr("Add at least one photo.");
    if (/https?:\/\/|www\./i.test(caption)) return setErr("Links are not allowed in posts.");
    if (/([0-9][ -]?){9,}/.test(caption)) return setErr("Please do not put phone numbers in posts.");
    setBusy(true);
    try {
      await createPost(user!.id, files, caption, place, district, { visibility, allowComments, showLikes });
      nav("/dashboard");
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="grid grid-cols-[44px_1fr_auto] items-center">
        <Link to="/dashboard" aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-stone-100"><Icon name="arrowLeft" size={22} /></Link>
        <h1 className="text-center font-display text-xl font-semibold">New post</h1>
        <button onClick={submit} disabled={busy} className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Posting..." : "Share"}</button>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
        <span className="rounded-lg bg-white py-2 text-center text-brand-700 shadow-sm">Post</span>
        <Link to="/story/new" className="rounded-lg py-2 text-center text-stone-500">Story</Link>
      </div>

      {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      <div className={panel}>
        <div className="grid grid-cols-3 gap-2">
          {previews.map((src, i) => (
            <div key={src} className="relative aspect-square overflow-hidden rounded-xl">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"><Icon name="x" size={14} /></button>
            </div>
          ))}
          {files.length < MAX && (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-200 text-brand-600 hover:bg-brand-50">
              <Icon name="image" size={26} /><span className="text-xs font-medium">Add photo</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => pick(e.target.files)} />
        <p className="mt-2 text-xs text-stone-500">Up to {MAX} photos. Share family occasions, hobbies, travel or events. Photos must be yours.</p>
      </div>

      <div className={`${panel} space-y-3`}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Caption</span>
          <textarea className={input} rows={4} maxLength={1000} placeholder="Write something... add #hashtags like #wedding #travel #family"
            value={caption} onChange={(e) => setCaption(e.target.value)} />
        </label>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => <span key={t} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">#{t}</span>)}
          </div>
        )}
      </div>

      <div className={`${panel} space-y-3`}>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Icon name="mapPin" size={18} />Location</h2>
        <input className={input} placeholder="Place (optional), e.g. Galle Face Green" maxLength={80} value={place} onChange={(e) => setPlace(e.target.value)} />
        <select className={input} value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">District (optional)</option>
          {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className={`${panel} space-y-3`}>
        <h2 className="font-display text-lg font-semibold">Who can see this?</h2>
        {([["members", "Registered members", "Every face-verified member"], ["matches", "Matches only", "Only people you are connected with"], ["private", "Only me", "Saved privately"]] as const).map(([v, t, d]) => (
          <button key={v} type="button" onClick={() => setVisibility(v)} className="flex w-full items-center gap-3 text-left">
            <span className="flex-1"><span className="block text-sm font-medium">{t}</span><span className="block text-xs text-stone-500">{d}</span></span>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${visibility === v ? "border-brand-600 bg-brand-600 text-white" : "border-stone-300"}`}>{visibility === v && <Icon name="check" size={14} strokeWidth={3} />}</span>
          </button>
        ))}
        <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-sm"><span>Allow comments</span><Toggle label="Allow comments" checked={allowComments} onChange={setAllowComments} /></div>
        <div className="flex items-center justify-between text-sm"><span>Show like count</span><Toggle label="Show like count" checked={showLikes} onChange={setShowLikes} /></div>
      </div>

      <p className="text-center text-xs text-stone-500">
        Visible to face-verified members. No links or phone numbers. Limit: 5 posts per day.
      </p>
      <button onClick={submit} disabled={busy} className={btnPrimary}>{busy ? "Posting..." : "Share post"}</button>
    </div>
  );
}
