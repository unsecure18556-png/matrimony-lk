import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createStory, emptyOverlay, FILTERS, type Overlay } from "../../services/storyService";
import StoryStage from "../../components/stories/StoryStage";
import Icon, { type IconName } from "../../components/ui/Icon";
import VerifyNotice from "../../components/VerifyNotice";

type Tool = "filter" | "adjust" | "text" | "sticker" | "draw" | "music" | "place" | "more";
// top-bar icons, in the same order as Instagram's story editor: text, stickers, draw, effects, music, more
const TOOLS: [Tool, IconName, string][] = [
  ["text", "type", "Text"], ["sticker", "smile", "Stickers"], ["draw", "pen", "Draw"],
  ["filter", "sparkles", "Effects"], ["music", "music", "Music"], ["more", "dots", "More"],
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
  const [tool, setTool] = useState<Tool | null>(null);
  const [caption, setCaption] = useState("");
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
    setFile(f); setType(isVideo ? "video" : "image"); setUrl(u); setOv(emptyOverlay()); setTool(null); setCaption("");
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
      const cap = caption.trim();
      const overlay: Overlay = cap ? { ...ov, texts: [...ov.texts, { id: uid(), text: cap, color: "#ffffff", x: 0.5, y: 0.86, size: 6 }] } : ov;
      await createStory(user!.id, { file, mediaType: type, overlay, visibility, music: music ? { file: music.file, title: music.title, start: music.start } : null });
      nav("/dashboard");
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  const shell = "fixed inset-0 z-[60] flex flex-col bg-black text-white";
  const di = "w-full rounded-lg bg-white/15 px-3 py-2.5 text-white placeholder:text-white/60 focus:outline-none";
  const circle = "flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm";

  /* ---------------- step 1: choose media ---------------- */
  if (!file) {
    const big = "flex flex-col items-center gap-2.5 rounded-2xl bg-white/10 p-5 text-sm font-semibold text-white active:scale-[.98]";
    const ico = "flex h-12 w-12 items-center justify-center rounded-full bg-white/15";
    return (
      <div className={shell}>
        <div className="safe-top grid grid-cols-[48px_1fr_48px] items-center px-2 pt-2">
          <Link to="/dashboard" aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full"><Icon name="x" size={26} /></Link>
          <h1 className="text-center font-sans text-base font-bold">New story</h1><span />
        </div>
        {err && <p className="mx-4 mt-2 rounded-xl bg-red-500/25 p-3 text-sm text-red-100">{err}</p>}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-8 text-center shadow-xl">
            <p className="font-display text-2xl font-semibold">Share a moment</p>
            <p className="mt-1 text-sm text-white">Photo or video, gone after 24 hours</p>
          </div>
          <div className="grid w-full max-w-sm grid-cols-3 gap-3">
            <button onClick={() => galleryRef.current?.click()} className={big}><span className={ico}><Icon name="image" size={24} /></span>Gallery</button>
            <button onClick={() => photoRef.current?.click()} className={big}><span className={ico}><Icon name="camera" size={24} /></span>Camera</button>
            <button onClick={() => videoRef.current?.click()} className={big}><span className={ico}><Icon name="video" size={24} /></span>Video</button>
          </div>
          <p className="text-center text-xs text-white/80">Videos can be up to {MAX_VIDEO_S} seconds.</p>
        </div>
        <div className="safe-bottom px-6 pb-4">
          <div className="mx-auto grid max-w-xs grid-cols-2 rounded-full bg-white/10 p-1 text-sm font-semibold">
            <Link to="/create" className="rounded-full py-2 text-center text-white/80">POST</Link>
            <span className="rounded-full bg-white py-2 text-center text-[#3A1F2B]">STORY</span>
          </div>
        </div>
        <input ref={galleryRef} type="file" accept="image/*,video/*" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={videoRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    );
  }

  /* ---------------- step 2: edit (Instagram-style full-screen editor) ---------------- */
  const swatches = (cur: string, on: (c: string) => void) => (
    <div className="flex items-center justify-center gap-2.5">
      {COLORS.map((c) => <button key={c} aria-label={`Color ${c}`} onClick={() => on(c)} className={`h-7 w-7 rounded-full border-2 ${cur === c ? "border-white scale-110" : "border-white/50"}`} style={{ background: c }} />)}
    </div>
  );
  const slider = (label: string, v: number, min: number, max: number, on: (n: number) => void) => (
    <label className="flex items-center gap-3 text-sm"><span className="w-24 shrink-0 text-white">{label}</span><input type="range" min={min} max={max} value={v} onChange={(e) => on(Number(e.target.value))} className="w-full accent-brand-500" /></label>
  );
  const fmt = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
  const sheet = "absolute inset-x-0 bottom-0 z-20 space-y-3 rounded-t-2xl bg-black/80 p-4 text-white backdrop-blur-md";
  const done = <button onClick={() => setTool(null)} className="ml-auto block text-sm font-bold text-white">Done</button>;
  const full = tool === "text";

  return (
    <div className={shell}>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="relative" style={{ width: "min(100%, calc((100dvh - 128px) * 9 / 16))" }}>
          <StoryStage overlay={ov} mediaUrl={url} mediaType={type} stageRef={stageRef} editable selected={selected} onItemDown={itemDown} onRemove={removeItem}
            className="rounded-2xl" style={{ touchAction: "none", cursor: tool === "draw" ? "crosshair" : "grab" }}
            onPointerDown={stageDown} onPointerMove={stageMove} onPointerUp={stageUp} onPointerCancel={stageUp} />

          {/* top icon row, like Instagram */}
          {!full && (
            <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 p-3" onPointerDown={(e) => e.stopPropagation()}>
              <button aria-label="Close" className={circle} onClick={() => { audioRef.current?.pause(); setPlaying(false); setFile(null); setUrl(""); setMusic(null); }}><Icon name="x" size={22} /></button>
              <div className="ml-auto flex items-center gap-1.5">
                {TOOLS.map(([k, icon, label]) => (
                  <button key={k} aria-label={label} onClick={() => setTool(tool === k ? null : k)} className={`${circle} ${tool === k || (k === "music" && music) ? "!bg-white !text-[#3A1F2B]" : ""}`}><Icon name={icon} size={20} /></button>
                ))}
              </div>
            </div>
          )}
          {err && <p className="absolute inset-x-3 top-16 z-10 rounded-xl bg-red-600 p-2.5 text-center text-sm text-white">{err}</p>}

          {/* text: centred typing like Instagram */}
          {full && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 rounded-2xl bg-black/70 p-5">
              <button className="absolute right-4 top-4 text-sm font-bold text-white" onClick={() => {
                const t = textDraft.trim();
                if (t) { const id = uid(); setOv((o) => ({ ...o, texts: [...o.texts, { id, text: t, color, x: 0.5, y: 0.5, size: 8 }] })); setSelected(id); }
                setTextDraft(""); setTool(null);
              }}>Done</button>
              <textarea autoFocus rows={3} maxLength={120} value={textDraft} onChange={(e) => setTextDraft(e.target.value)} placeholder="Start typing"
                className="w-full resize-none bg-transparent text-center text-3xl font-bold placeholder:text-white/50 focus:outline-none" style={{ color }} />
              {swatches(color, setColor)}
            </div>
          )}

          {tool === "filter" && (
            <div className={sheet}>
              {done}
              <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {Object.entries(FILTERS).map(([k, f]) => (
                  <button key={k} onClick={() => set({ filter: k })} className="shrink-0 text-center">
                    <span className={`block h-16 w-16 overflow-hidden rounded-xl bg-white/20 ring-2 ${ov.filter === k ? "ring-white" : "ring-transparent"}`}>
                      {type === "image" && <img src={url} alt="" className="h-full w-full object-cover" style={{ filter: f.css }} />}
                    </span>
                    <span className="mt-1 block text-[11px] font-medium text-white">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool === "sticker" && (
            <div className={sheet}>
              {done}
              <div className="grid grid-cols-8 gap-1">
                {EMOJI.map((em) => <button key={em} className="rounded-lg p-1 text-2xl active:bg-white/20" onClick={() => { const id = uid(); setOv((o) => ({ ...o, stickers: [...o.stickers, { id, emoji: em, x: 0.5, y: 0.5, size: 16 }] })); setSelected(id); setTool(null); }}>{em}</button>)}
              </div>
            </div>
          )}

          {tool === "draw" && (
            <div className={sheet}>
              <div className="flex items-center">
                <button className="flex items-center gap-1.5 text-sm font-medium text-white" onClick={() => setOv((o) => ({ ...o, strokes: o.strokes.slice(0, -1) }))}><Icon name="undo" size={16} />Undo</button>
                <div className="mx-auto flex items-center gap-2">
                  {BRUSH.map((_, i) => <button key={i} aria-label={`Brush ${i + 1}`} onClick={() => setBrush(i)} className={`flex h-9 w-9 items-center justify-center rounded-full ${brush === i ? "bg-white/30" : "bg-white/10"}`}><span className="rounded-full bg-white" style={{ width: 6 + i * 6, height: 6 + i * 6 }} /></button>)}
                </div>
                <button onClick={() => setTool(null)} className="text-sm font-bold text-white">Done</button>
              </div>
              {swatches(color, setColor)}
            </div>
          )}

          {tool === "music" && (
            <div className={sheet}>
              {done}
              <input ref={musicRef} type="file" accept="audio/*" hidden onChange={(e) => { chooseMusic(e.target.files?.[0]); e.target.value = ""; }} />
              {!music ? (
                <>
                  <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-[#3A1F2B]" onClick={() => musicRef.current?.click()}><Icon name="music" size={18} />Choose a song from your device</button>
                  <p className="text-xs text-white/80">Use music you own or have permission to share. MP3, M4A or WAV, up to {MAX_MUSIC_MB} MB.</p>
                </>
              ) : (
                <>
                  <input className={di} value={music.title} maxLength={60} onChange={(e) => setMusic({ ...music, title: e.target.value })} placeholder="Song title" />
                  {slider("Start at", Math.round(music.start), 0, Math.max(0, Math.floor(music.duration) - 1), (n) => { setMusic({ ...music, start: n }); if (playing) { audioRef.current!.currentTime = n; } })}
                  <p className="text-xs text-white/80">Starts at {fmt(music.start)} of {fmt(music.duration)}</p>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white" onClick={togglePreview}><Icon name={playing ? "pause" : "play"} size={16} filled={!playing} />{playing ? "Pause" : "Preview"}</button>
                    <button className="rounded-full bg-white/20 px-4 py-2 text-sm text-white" onClick={() => { audioRef.current?.pause(); setPlaying(false); URL.revokeObjectURL(music.url); setMusic(null); }}>Remove</button>
                  </div>
                  {type === "video" && <p className="text-xs text-white/80">The video's own sound is muted when music is added.</p>}
                </>
              )}
            </div>
          )}

          {tool === "more" && (
            <div className={sheet}>
              {done}
              <button className="flex w-full items-center gap-3 py-2 text-left text-[15px] text-white" onClick={() => setTool("adjust")}><Icon name="sliders" size={20} />Adjust &amp; zoom</button>
              <button className="flex w-full items-center gap-3 py-2 text-left text-[15px] text-white" onClick={() => setTool("place")}><Icon name="mapPin" size={20} />Add location</button>
            </div>
          )}

          {tool === "adjust" && (
            <div className={sheet}>
              {done}
              {slider("Brightness", ov.adjust.b, 50, 150, (n) => set({ adjust: { ...ov.adjust, b: n } }))}
              {slider("Contrast", ov.adjust.c, 50, 150, (n) => set({ adjust: { ...ov.adjust, c: n } }))}
              {slider("Saturation", ov.adjust.s, 0, 200, (n) => set({ adjust: { ...ov.adjust, s: n } }))}
              {slider("Zoom", Math.round(ov.zoom * 100), 100, 300, (n) => set({ zoom: n / 100, ox: 0, oy: 0 }))}
              <p className="text-xs text-white/80">Drag the picture to move it when zoomed in.</p>
              <button className="text-sm font-semibold text-white underline" onClick={() => set({ adjust: { b: 100, c: 100, s: 100 }, zoom: 1, ox: 0, oy: 0 })}>Reset</button>
            </div>
          )}

          {tool === "place" && (
            <div className={sheet}>
              {done}
              <input className={di} maxLength={40} placeholder="Add a location, e.g. Galle Face" value={ov.location ?? ""} onChange={(e) => set({ location: e.target.value || undefined })} />
            </div>
          )}

          {/* size controls for the selected text / sticker */}
          {!tool && (selText || selSticker) && (
            <div className="absolute inset-x-3 bottom-3 z-10 rounded-xl bg-black/60 p-3 backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
              {selText && slider("Text size", selText.size, 4, 20, (n) => setOv((o) => ({ ...o, texts: o.texts.map((t) => (t.id === selText.id ? { ...t, size: n } : t)) })))}
              {selText && <div className="mt-2">{swatches(selText.color, (c) => setOv((o) => ({ ...o, texts: o.texts.map((t) => (t.id === selText.id ? { ...t, color: c } : t)) })))}</div>}
              {selSticker && slider("Size", selSticker.size, 8, 40, (n) => setOv((o) => ({ ...o, stickers: o.stickers.map((t) => (t.id === selSticker.id ? { ...t, size: n } : t)) })))}
            </div>
          )}
        </div>
      </div>
      {music && <audio ref={audioRef} src={music.url} onEnded={() => setPlaying(false)} />}

      {/* bottom bar: caption + Your story / Matches + send arrow, like Instagram */}
      <div className="safe-bottom space-y-2.5 px-3 pb-3 pt-2">
        <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={80} placeholder="Add a caption…"
          className="w-full rounded-full bg-white/15 px-4 py-2.5 text-[15px] text-white placeholder:text-white/70 focus:outline-none" />
        <div className="flex items-center gap-2">
          <button onClick={() => setVisibility("members")} className={`flex flex-1 items-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold text-white ${visibility === "members" ? "bg-white/25 ring-2 ring-white" : "bg-white/10"}`}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25"><Icon name="user" size={14} /></span>Your story
          </button>
          <button onClick={() => setVisibility("matches")} className={`flex flex-1 items-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold text-white ${visibility === "matches" ? "bg-white/25 ring-2 ring-white" : "bg-white/10"}`}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500"><Icon name="star" size={13} filled /></span>Matches only
          </button>
          <button onClick={share} disabled={busy} aria-label="Share story" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#3A1F2B] disabled:opacity-50">
            {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#3A1F2B] border-t-transparent" /> : <Icon name="arrowRight" size={22} strokeWidth={2.4} />}
          </button>
        </div>
      </div>
    </div>
  );
}
