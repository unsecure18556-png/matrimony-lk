import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createPost, extractHashtags, type Visibility } from "../../services/postService";
import Icon from "../../components/ui/Icon";
import { DISTRICTS } from "../../utils/constants";
import Toggle from "../../components/ui/Toggle";
import VerifyNotice from "../../components/VerifyNotice";

const MAX = 4;
const VIS: Record<Visibility, [string, string]> = {
  members: ["Registered members", "Every face-verified member"],
  matches: ["Matches only", "Only people you are connected with"],
  private: ["Only me", "Saved privately"],
};

export default function CreatePostPage() {
  const { user, profile, account } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [place, setPlace] = useState("");
  const [district, setDistrict] = useState(profile?.district ?? "");
  const [visibility, setVisibility] = useState<Visibility>("members");
  const [allowComments, setAllowComments] = useState(true);
  const [showLikes, setShowLikes] = useState(true);
  const [open, setOpen] = useState<"" | "place" | "vis" | "adv">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const tags = useMemo(() => extractHashtags(caption), [caption]);

  if (!user || !profile) return null;
  if (!profile.face_verified && account?.role !== "admin") return <VerifyNotice what="create posts" />;

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

  const fileInput = <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => pick(e.target.files)} />;
  const row = "flex w-full items-center justify-between border-b border-stone-200 px-4 py-3.5 text-left text-[15px]";

  /* ---------------- step 1: pick photos (like Instagram's "New post" gallery screen) ---------------- */
  if (files.length === 0) {
    return (
      <div className="mx-auto max-w-md">
        <div className="grid grid-cols-[44px_1fr_44px] items-center pb-2">
          <Link to="/dashboard" aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-stone-100"><Icon name="x" size={24} /></Link>
          <h1 className="text-center font-sans text-base font-bold">New post</h1><span />
        </div>
        {err && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl bg-stone-100 text-stone-600 active:scale-[.99]">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm"><Icon name="image" size={30} className="text-brand-600" /></span>
          <span className="text-base font-semibold text-ink">Select photos from gallery</span>
          <span className="text-xs">Up to {MAX} photos</span>
        </button>
        {fileInput}
        <div className="mt-4 grid grid-cols-2 rounded-full bg-stone-100 p-1 text-sm font-semibold">
          <span className="rounded-full bg-white py-2 text-center text-ink shadow-sm">POST</span>
          <Link to="/story/new" className="rounded-full py-2 text-center text-stone-500">STORY</Link>
        </div>
        <p className="mt-3 text-center text-xs text-stone-500">Share family occasions, hobbies, travel or events. Photos must be yours.</p>
      </div>
    );
  }

  /* ---------------- step 2: details (matches Instagram's "New post" share screen) ---------------- */
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5">
      <div className="grid grid-cols-[44px_1fr_auto] items-center border-b border-stone-200 px-1 py-1.5">
        <button aria-label="Back" onClick={() => setFiles([])} className="flex h-11 w-11 items-center justify-center rounded-full"><Icon name="arrowLeft" size={22} /></button>
        <h1 className="text-center font-sans text-base font-bold">New post</h1>
        <button onClick={submit} disabled={busy} className="px-4 py-2 text-[15px] font-bold text-brand-600 disabled:opacity-50">{busy ? "Sharing…" : "Share"}</button>
      </div>

      {err && <p className="m-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      <div className="flex items-start gap-3 border-b border-stone-200 p-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-stone-200">
          <img src={previews[0]} alt="" className="h-full w-full object-cover" />
          {files.length > 1 && <span className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">1/{files.length}</span>}
        </div>
        <textarea rows={3} maxLength={1000} value={caption} onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption… add #hashtags"
          className="min-h-16 flex-1 resize-none bg-transparent pt-1 text-[15px] text-ink placeholder:text-stone-400 focus:outline-none" />
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-stone-200 px-4 py-2.5">
          {tags.map((t) => <span key={t} className="text-sm font-medium text-brand-600">#{t}</span>)}
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto border-b border-stone-200 px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {previews.map((src, i) => (
          <div key={src} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md">
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white"><Icon name="x" size={11} strokeWidth={3} /></button>
          </div>
        ))}
        {files.length < MAX && (
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Add photo"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-600"><Icon name="plus" size={22} /></button>
        )}
        {fileInput}
      </div>

      <button className={row} onClick={() => setOpen(open === "place" ? "" : "place")}>
        <span className="flex items-center gap-3"><Icon name="mapPin" size={20} />Add location</span>
        <span className="flex items-center gap-1 text-sm text-stone-500">{place || district || ""}<Icon name="chevronRight" size={18} className={open === "place" ? "rotate-90" : ""} /></span>
      </button>
      {open === "place" && (
        <div className="space-y-3 border-b border-stone-200 px-4 py-3">
          <input value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} placeholder="Place, e.g. Galle Face Green"
            className="w-full rounded-lg bg-stone-100 px-3 py-2.5 text-ink placeholder:text-stone-400 focus:outline-none" />
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto border-b border-stone-200 px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[...new Set([profile.district ?? "", ...DISTRICTS])].filter(Boolean).slice(0, 12).map((d) => (
          <button key={d} type="button" onClick={() => setDistrict(district === d ? "" : d)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium ${district === d ? "bg-brand-600 text-white" : "bg-stone-100 text-ink"}`}>{d}</button>
        ))}
      </div>

      <button className={row} onClick={() => setOpen(open === "vis" ? "" : "vis")}>
        <span className="flex items-center gap-3"><Icon name="users" size={20} />Audience</span>
        <span className="flex items-center gap-1 text-sm text-stone-500">{VIS[visibility][0]}<Icon name="chevronRight" size={18} className={open === "vis" ? "rotate-90" : ""} /></span>
      </button>
      {open === "vis" && (
        <div className="space-y-3 border-b border-stone-200 px-4 py-3">
          {(Object.keys(VIS) as Visibility[]).map((v) => (
            <button key={v} type="button" onClick={() => setVisibility(v)} className="flex w-full items-center gap-3 text-left">
              <span className="flex-1"><span className="block text-sm font-medium">{VIS[v][0]}</span><span className="block text-xs text-stone-500">{VIS[v][1]}</span></span>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${visibility === v ? "border-brand-600 bg-brand-600 text-white" : "border-stone-300"}`}>{visibility === v && <Icon name="check" size={14} strokeWidth={3} />}</span>
            </button>
          ))}
        </div>
      )}

      <button className={row} onClick={() => setOpen(open === "adv" ? "" : "adv")}>
        <span className="flex items-center gap-3"><Icon name="sliders" size={20} />Advanced settings</span>
        <Icon name="chevronRight" size={18} className={`text-stone-500 ${open === "adv" ? "rotate-90" : ""}`} />
      </button>
      {open === "adv" && (
        <div className="space-y-4 px-4 py-4 text-[15px]">
          <div className="flex items-center justify-between"><span>Turn on commenting</span><Toggle label="Allow comments" checked={allowComments} onChange={setAllowComments} /></div>
          <div className="flex items-center justify-between"><span>Show like count</span><Toggle label="Show like count" checked={showLikes} onChange={setShowLikes} /></div>
        </div>
      )}
      <p className="px-4 py-4 text-center text-xs text-stone-500">No links or phone numbers. Limit: 5 posts per day.</p>
    </div>
  );
}
