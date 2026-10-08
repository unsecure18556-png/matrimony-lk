import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createStory, emptyOverlay, FILTERS, type Overlay } from "../../services/storyService";
import StoryStage from "../../components/stories/StoryStage";
import Icon, { type IconName } from "../../components/ui/Icon";
import { input } from "../../components/ui/styles";
import VerifyNotice from "../../components/VerifyNotice";

type Tool = "filter" | "adjust" | "text" | "sticker" | "draw" | "music" | "place";
const TOOLS: [Tool, IconName, string][] = [
  ["filter", "sparkles", "Filters"], ["adjust", "sliders", "Adjust"], ["text", "type", "Text"], ["sticker", "smile", "Stickers"],
  ["draw", "pen", "Draw"], ["music", "music", "Music"], ["place", "mapPin", "Place"],
];
const COLORS = ["#ffffff", "#000000", "#E85D75", "#F7C6D0", "#facc15", "#34d399", "#60a5fa"];
const BRUSH = [0.08, 0.16, 0.3];
const EMOJI = ["❤️", "😍", "😂", "🔥", "🎉", "💍", "🌸", "✨", "😊", "🙏", "👏", "💐", "🌹", "🥰", "😎", "🌴", "☀️", "🌙", "🎶", "💫", "🪔", "🍰", "📸", "💕"];
const MAX_MB = 25, MAX_VIDEO_S = 30, MAX_MUSIC_MB = 8;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const uid = () => Math.random().toString(36).slice(2, 9);

interface Drag { kind: "text" | "sticker" | "pan" | "draw"; id?: string; sx: number; sy: number; ox: number; oy: number }
interface Music { file: File; url: string; title: string; start: number; duration: number }

export default function StoryCreatePage() {
  const { user, profile, account } = useAuth();
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<"image" | "video">("image");
  const [url, setUrl] = useState("");
  const [ov, setOv] = useState<Overlay>(emptyOverlay());
  const [tool, setTool] = useState<Tool>("filter");
  const [selected, setSelected] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [color, setColor] = useState("#ffffff");
  const [brush, setBrush] = useState(1);
  const [music, setMusic] = useState<Music | null>(null);
  const [playing, setPlaying] = useState(false);
  const [visibility, setVisibility] = useState<"members" | "matches">("members");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); if (music) URL.revokeObjectURL(music.url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;
  if (profile && !profile.face_verified && account?.role !== "admin") return <VerifyNotice what="add stories" />;
  const set = (patch: Partial<Overlay>) => setOv((o) => ({ ...o, ...patch }));

  async function choose(f?: File | null) {
    if (!f) return;
    setErr("");
    const isVideo = f.type.startsWith("video/");
    if (!isVideo && !f.type.startsWith("image/")) return setErr("Choose a photo or a video.");
    if (f.size > MAX_MB * 1024 * 1024 * (isVideo ? 1 : 3)) return setErr(`File is too large (max ${MAX_MB} MB for videos).`);
    const u = URL.createObjectURL(f);
    if (isVideo) {
      const dur = await new Promise<number>((res) => { const v = document.createElement("video"); v.preload = "metadata"; v.onloadedmetadata = () => res(v.duration); v.onerror = () => res(0); v.src = u; });
      if (dur > MAX_VIDEO_S + 0.5) { URL.revokeObjectURL(u); return setErr(`Videos can be up to ${MAX_VIDEO_S} seconds. Yours is ${Math.round(dur)} seconds.`); }
    }
    setFile(f); setType(isVideo ? "video" : "image"); setUrl(u); setOv(emptyOverlay()); setTool("filter");
  }

  async function chooseMusic(f?: File | null) {
    if (!f) return;
    setErr("");
    if (!f.type.startsWith("audio/")) return setErr("Choose an audio file (MP3, M4A, WAV).");
    if (f.size > MAX_MUSIC_MB * 1024 * 1024) return setErr(`Music file is too large (max ${MAX_MUSIC_MB} MB).`);
    const u = URL.createObjectURL(f);
    const duration = await new Promise<number>((res) => { const a = new Audio(); a.preload = "metadata"; a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(0); a.src = u; });
    if (!duration) { URL.revokeObjectURL(u); return setErr("Could not read that audio file."); }
    if (music) URL.revokeObjectURL(music.url);
    setMusic({ file: f, url: u, title: f.name.replace(/\.[^.]+$/, "").slice(0, 60), start: 0, duration });
  }

  function togglePreview() {
    const a = audioRef.current; if (!a || !music) return;
    if (playing) { a.pause(); setPlaying(false); return; }
    a.currentTime = music.start; a.play().then(() => setPlaying(true)).catch(() => setErr("Tap again to play the preview."));
  }

  // ----- pointer handling on the stage -----
  const rect = () => stageRef.current!.getBoundingClientRect();
  function stageDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = rect();
    if (tool === "draw") {
      const pt: [number, number] = [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)];
      setOv((o) => ({ ...o, strokes: [...o.strokes, { color, w: BRUSH[brush], pts: [pt] }] }));
      drag.current = { kind: "draw", sx: 0, sy: 0, ox: 0, oy: 0 };
    } else {
      setSelected(null);
      drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: ov.ox, oy: ov.oy };
    }
  }
  function itemDown(kind: "text" | "sticker", id: string, e: PointerEvent<HTMLElement>) {
    if (tool === "draw") return;
    e.stopPropagation();
    stageRef.current?.setPointerCapture(e.pointerId);
    const it = (kind === "text" ? ov.texts : ov.stickers).find((x) => x.id === id)!;
    setSelected(id);
    drag.current = { kind, id, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y };
  }
  function stageMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current; if (!d) return;
    const r = rect();
    if (d.kind === "draw") {
      const pt: [number, number] = [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)];
      setOv((o) => { const s = [...o.strokes]; const last = s[s.length - 1]; if (last) s[s.length - 1] = { ...last, pts: [...last.pts, pt] }; return { ...o, strokes: s }; });
    } else if (d.kind === "pan") {
      const lim = (ov.zoom - 1) * 50;
      set({ ox: clamp(d.ox + ((e.clientX - d.sx) / r.width) * 100, -lim, lim), oy: clamp(d.oy + ((e.clientY - d.sy) / r.height) * 100, -lim, lim) });
    } else {
      const x = clamp(d.ox + (e.clientX - d.sx) / r.width, 0.03, 0.97), y = clamp(d.oy + (e.clientY - d.sy) / r.height, 0.03, 0.97);
      setOv((o) => d.kind === "text"
        ? { ...o, texts: o.texts.map((t) => (t.id === d.id ? { ...t, x, y } : t)) }
        : { ...o, stickers: o.stickers.map((t) => (t.id === d.id ? { ...t, x, y } : t)) });
    }
  }
  const stageUp = () => { drag.current = null; };

  const removeItem = (kind: "text" | "sticker", id: string) => {
    setSelected(null);
    setOv((o) => kind === "text" ? { ...o, texts: o.texts.filter((t) => t.id !== id) } : { ...o, stickers: o.stickers.filter((t) => t.id !== id) });
  };
  const selText = ov.texts.find((t) => t.id === selected);
  const selSticker = ov.stickers.find((t) => t.id === selected);

  async function share() {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      await createStory(user!.id, { file, mediaType: type, overlay: ov, visibility, music: music ? { file: music.file, title: music.title, start: music.start } : null });
      nav("/dashboard");
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  /* ---------------- step 1: choose media ---------------- */
  if (!file) {
    const big = "flex flex-col items-center gap-2 rounded-2xl bg-white p-6 text-sm font-medium shadow-sm ring-1 ring-stone-900/5 hover:shadow-md";
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="grid grid-cols-[44px_1fr_44px] items-center">
          <Link to="/dashboard" aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-stone-100"><Icon name="arrowLeft" size={22} /></Link>
          <h1 className="text-center font-display text-xl font-semibold">New story</h1><span />
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
          <Link to="/create" className="rounded-lg py-2 text-center text-stone-500">Post</Link>
          <span className="rounded-lg bg-white py-2 text-center text-brand-700 shadow-sm">Story</span>
        </div>
        {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => galleryRef.current?.click()} className={big}><span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Icon name="image" size={24} /></span>Gallery</button>
          <button onClick={() => photoRef.current?.click()} className={big}><span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Icon name="camera" size={24} /></span>Camera</button>
          <button onClick={() => videoRef.current?.click()} className={big}><span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Icon name="video" size={24} /></span>Video</button>
        </div>
        <p className="text-center text-xs text-stone-500">Stories disappear after 24 hours. Videos can be up to {MAX_VIDEO_S} seconds.</p>
        <input ref={galleryRef} type="file" accept="image/*,video/*" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={videoRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    );
  }

  /* ---------------- step 2: edit ---------------- */
  const chip = (on: boolean) => `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${on ? "bg-brand-600 text-white" : "bg-stone-100"}`;
  const slider = (label: string, v: number, min: number, max: number, on: (n: number) => void) => (
    <label className="flex items-center gap-3 text-sm"><span className="w-24 shrink-0">{label}</span><input type="range" min={min} max={max} value={v} onChange={(e) => on(Number(e.target.value))} className="w-full accent-brand-600" /></label>
  );

  return (
    <div className="mx-auto max-w-md space-y-3">
      <div className="grid grid-cols-[44px_1fr_auto] items-center">
        <button aria-label="Back" onClick={() => { setFile(null); setUrl(""); setMusic(null); }} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-stone-100"><Icon name="arrowLeft" size={22} /></button>
        <h1 className="text-center font-display text-xl font-semibold">Edit story</h1>
        <button onClick={share} disabled={busy} className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Sharing..." : "Share"}</button>
      </div>
      {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      <div className="mx-auto" style={{ width: "min(100%, calc(62dvh * 9 / 16))" }}>
        <StoryStage overlay={ov} mediaUrl={url} mediaType={type} stageRef={stageRef} editable selected={selected} onItemDown={itemDown} onRemove={removeItem}
          className="rounded-2xl" style={{ touchAction: "none", cursor: tool === "draw" ? "crosshair" : "grab" }}
          onPointerDown={stageDown} onPointerMove={stageMove} onPointerUp={stageUp} onPointerCancel={stageUp} />
      </div>
      {music && <audio ref={audioRef} src={music.url} onEnded={() => setPlaying(false)} />}

      <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TOOLS.map(([k, icon, label]) => (
          <button key={k} onClick={() => setTool(k)} className={`flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium ${tool === k ? "bg-brand-100 text-brand-700" : "text-stone-600"}`}>
            <Icon name={icon} size={21} />{label}
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-900/5">
        {tool === "filter" && (
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {Object.entries(FILTERS).map(([k, f]) => <button key={k} className={chip(ov.filter === k)} onClick={() => set({ filter: k })}>{f.label}</button>)}
          </div>
        )}

        {tool === "adjust" && (
          <>
            {slider("Brightness", ov.adjust.b, 50, 150, (n) => set({ adjust: { ...ov.adjust, b: n } }))}
            {slider("Contrast", ov.adjust.c, 50, 150, (n) => set({ adjust: { ...ov.adjust, c: n } }))}
            {slider("Saturation", ov.adjust.s, 0, 200, (n) => set({ adjust: { ...ov.adjust, s: n } }))}
            {slider("Zoom", Math.round(ov.zoom * 100), 100, 300, (n) => set({ zoom: n / 100, ox: 0, oy: 0 }))}
            <p className="text-xs text-stone-500">Drag the picture to move it when zoomed in.</p>
            <button className="text-sm font-medium text-brand-700" onClick={() => set({ adjust: { b: 100, c: 100, s: 100 }, zoom: 1, ox: 0, oy: 0 })}>Reset adjustments</button>
          </>
        )}

        {tool === "text" && (
          <>
            <textarea className={input} rows={2} maxLength={120} placeholder="Type something..." value={textDraft} onChange={(e) => setTextDraft(e.target.value)} />
            <div className="flex items-center gap-2">
              {COLORS.map((c) => <button key={c} aria-label={`Color ${c}`} onClick={() => { setColor(c); if (selText) setOv((o) => ({ ...o, texts: o.texts.map((t) => (t.id === selText.id ? { ...t, color: c } : t)) })); }}
                className={`h-8 w-8 rounded-full ring-2 ${color === c ? "ring-brand-600" : "ring-stone-300"}`} style={{ background: c }} />)}
            </div>
            <button disabled={!textDraft.trim()} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => { const id = uid(); setOv((o) => ({ ...o, texts: [...o.texts, { id, text: textDraft.trim(), color, x: 0.5, y: 0.5, size: 8 }] })); setSelected(id); setTextDraft(""); }}>Add text</button>
            {selText && slider("Text size", selText.size, 4, 20, (n) => setOv((o) => ({ ...o, texts: o.texts.map((t) => (t.id === selText.id ? { ...t, size: n } : t)) })))}
          </>
        )}

        {tool === "sticker" && (
          <>
            <div className="grid grid-cols-8 gap-1.5">
              {EMOJI.map((em) => <button key={em} className="rounded-lg p-1 text-2xl hover:bg-stone-100" onClick={() => { const id = uid(); setOv((o) => ({ ...o, stickers: [...o.stickers, { id, emoji: em, x: 0.5, y: 0.5, size: 16 }] })); setSelected(id); }}>{em}</button>)}
            </div>
            {selSticker && slider("Size", selSticker.size, 8, 40, (n) => setOv((o) => ({ ...o, stickers: o.stickers.map((t) => (t.id === selSticker.id ? { ...t, size: n } : t)) })))}
          </>
        )}

        {tool === "draw" && (
          <>
            <p className="text-xs text-stone-500">Draw on the picture with your finger or mouse.</p>
            <div className="flex items-center gap-2">
              {COLORS.map((c) => <button key={c} aria-label={`Color ${c}`} onClick={() => setColor(c)} className={`h-8 w-8 rounded-full ring-2 ${color === c ? "ring-brand-600" : "ring-stone-300"}`} style={{ background: c }} />)}
            </div>
            <div className="flex items-center gap-2">
              {BRUSH.map((_, i) => <button key={i} aria-label={`Brush ${i + 1}`} onClick={() => setBrush(i)} className={`flex h-10 w-10 items-center justify-center rounded-full ${brush === i ? "bg-brand-100" : "bg-stone-100"}`}><span className="rounded-full bg-ink" style={{ width: 6 + i * 6, height: 6 + i * 6 }} /></button>)}
              <button className="ml-auto flex items-center gap-1.5 rounded-xl bg-stone-100 px-3 py-2 text-sm" onClick={() => setOv((o) => ({ ...o, strokes: o.strokes.slice(0, -1) }))}><Icon name="undo" size={16} />Undo</button>
              <button className="rounded-xl bg-stone-100 px-3 py-2 text-sm" onClick={() => setOv((o) => ({ ...o, strokes: [] }))}>Clear</button>
            </div>
          </>
        )}

        {tool === "music" && (
          <>
            <input ref={musicRef} type="file" accept="audio/*" hidden onChange={(e) => { chooseMusic(e.target.files?.[0]); e.target.value = ""; }} />
            {!music ? (
              <>
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white" onClick={() => musicRef.current?.click()}><Icon name="music" size={18} />Choose a song from your device</button>
                <p className="text-xs text-stone-500">Use music you own or have permission to share. MP3, M4A or WAV, up to {MAX_MUSIC_MB} MB.</p>
              </>
            ) : (
              <>
                <input className={input} value={music.title} maxLength={60} onChange={(e) => setMusic({ ...music, title: e.target.value })} placeholder="Song title" />
                {slider("Start at", Math.round(music.start), 0, Math.max(0, Math.floor(music.duration) - 1), (n) => { setMusic({ ...music, start: n }); if (playing) { audioRef.current!.currentTime = n; } })}
                <p className="text-xs text-stone-500">Starts at {Math.floor(music.start / 60)}:{String(Math.floor(music.start % 60)).padStart(2, "0")} of {Math.floor(music.duration / 60)}:{String(Math.floor(music.duration % 60)).padStart(2, "0")}</p>
                <div className="flex gap-2">
                  <button className="flex items-center gap-1.5 rounded-xl bg-stone-100 px-4 py-2 text-sm font-medium" onClick={togglePreview}><Icon name={playing ? "pause" : "play"} size={16} filled={!playing} />{playing ? "Pause" : "Preview"}</button>
                  <button className="rounded-xl bg-stone-100 px-4 py-2 text-sm" onClick={() => { audioRef.current?.pause(); setPlaying(false); URL.revokeObjectURL(music.url); setMusic(null); }}>Remove</button>
                </div>
                {type === "video" && <p className="text-xs text-stone-500">The video's own sound is muted when music is added.</p>}
              </>
            )}
          </>
        )}

        {tool === "place" && (
          <>
            <input className={input} maxLength={40} placeholder="Add a location, e.g. Galle Face" value={ov.location ?? ""} onChange={(e) => set({ location: e.target.value || undefined })} />
            <p className="text-xs text-stone-500">Shows as a tag on your story.</p>
          </>
        )}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-900/5">
        <p className="mb-2 text-sm font-semibold">Who can see this?</p>
        <div className="grid grid-cols-2 gap-2">
          {([["members", "All members"], ["matches", "Matches only"]] as const).map(([v, t]) => (
            <button key={v} onClick={() => setVisibility(v)} className={`rounded-xl py-2.5 text-sm font-medium ${visibility === v ? "bg-brand-600 text-white" : "bg-stone-100"}`}>{t}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
