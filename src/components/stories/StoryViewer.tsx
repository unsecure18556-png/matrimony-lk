import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { deleteStory, fetchViewers, markViewed, type StoryGroup } from "../../services/storyService";
import StoryStage from "./StoryStage";
import Icon from "../ui/Icon";
import { timeAgo } from "../../utils/time";

const IMAGE_MS = 6000;

export default function StoryViewer({ groups, startIndex, meId, onClose }: {
  groups: StoryGroup[]; startIndex: number; meId: string; onClose: (changed: boolean) => void;
}) {
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<{ id: string; name: string; at: string }[] | null>(null);
  const [changed, setChanged] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const press = useRef({ t: 0, x: 0 });

  const group = groups[gi];
  const stories = group ? group.stories.filter((s) => !removed.has(s.id)) : [];
  const story = stories[si];
  const mine = group?.userId === meId;

  const next = useCallback(() => {
    if (si < stories.length - 1) { setSi(si + 1); setProgress(0); }
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); setProgress(0); }
    else onClose(changed);
  }, [si, stories.length, gi, groups.length, onClose, changed]);
  const prev = () => {
    if (si > 0) { setSi(si - 1); setProgress(0); }
    else if (gi > 0) { setGi(gi - 1); setSi(0); setProgress(0); }
    else setProgress(0);
  };

  // reset + mark viewed + start music whenever the story changes
  useEffect(() => {
    if (!story) return;
    setProgress(0); setViewers(null);
    if (!mine) markViewed(meId, story.id);
    const a = audioRef.current;
    if (a && story.musicUrl) { a.currentTime = story.music_start; a.play().catch(() => {}); }
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // timer for photos (videos report their own progress)
  useEffect(() => {
    if (!story || story.media_type === "video" || paused || viewers) return;
    const t = setInterval(() => setProgress((p) => { const n = p + 50 / IMAGE_MS; if (n >= 1) { clearInterval(t); setTimeout(next, 0); return 1; } return n; }), 50);
    return () => clearInterval(t);
  }, [story?.id, story?.media_type, paused, viewers, next]); // eslint-disable-line react-hooks/exhaustive-deps

  // pause / resume media
  useEffect(() => {
    const hold = paused || !!viewers;
    const v = videoRef.current; const a = audioRef.current;
    if (hold) { v?.pause(); a?.pause(); } else { v?.play().catch(() => {}); if (story?.musicUrl) a?.play().catch(() => {}); }
  }, [paused, viewers, story?.musicUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(changed); if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") prev(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!group || !story) { setTimeout(() => onClose(changed), 0); return null; }

  function down(e: PointerEvent) { press.current = { t: Date.now(), x: e.clientX }; setPaused(true); }
  function up(e: PointerEvent) {
    setPaused(false);
    if (Date.now() - press.current.t > 280) return; // a long press only pauses
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    (e.clientX - rect.left) / rect.width < 0.3 ? prev() : next();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black" role="dialog" aria-label="Story">
      <div className="relative h-full w-full max-w-[460px] overflow-hidden md:h-[94dvh] md:rounded-3xl">
        <StoryStage overlay={story.overlay} mediaUrl={story.mediaUrl} mediaType={story.media_type} videoRef={videoRef} key={story.id}
          muted={!!story.musicUrl} onVideoEnded={next} onVideoTime={(c, d) => d && setProgress(c / d)}
          className="!aspect-auto h-full" onPointerDown={down} onPointerUp={up} onPointerLeave={() => setPaused(false)} onContextMenu={(e) => e.preventDefault()} />
        {story.musicUrl && <audio ref={audioRef} src={story.musicUrl} loop />}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="absolute inset-x-3 top-3 flex gap-1">
          {stories.map((s, i) => (
            <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
              <span className="block h-full bg-white" style={{ width: `${i < si ? 100 : i === si ? progress * 100 : 0}%` }} />
            </span>
          ))}
        </div>
        <div className="absolute inset-x-3 top-6 flex items-center gap-2.5 text-white">
          {group.photoUrl ? <img src={group.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-display">{group.name[0]}</span>}
          <span className="text-sm font-semibold drop-shadow">{mine ? "Your story" : group.name}</span>
          <span className="text-xs text-white/75">{timeAgo(story.created_at)}</span>
          <span className="flex-1" />
          {story.music_title && <span className="flex max-w-[40%] items-center gap-1 truncate rounded-full bg-black/40 px-2.5 py-1 text-xs"><Icon name="music" size={13} /><span className="truncate">{story.music_title}</span></span>}
          <button aria-label="Close" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => onClose(changed)} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40"><Icon name="x" size={20} /></button>
        </div>

        {mine && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-4 text-white" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <button onClick={async () => setViewers(await fetchViewers(story.id))} className="flex items-center gap-2 text-sm font-medium"><Icon name="eye" size={18} />Seen by</button>
            <button aria-label="Delete story" onClick={async () => {
              if (!confirm("Delete this story?")) return;
              await deleteStory(story); setChanged(true); setRemoved((r) => new Set(r).add(story.id));
            }} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"><Icon name="trash" size={19} /></button>
          </div>
        )}

        {viewers && (
          <div className="absolute inset-0 z-10 flex items-end bg-black/50" onClick={() => setViewers(null)}>
            <div className="max-h-[60%] w-full overflow-y-auto rounded-t-3xl bg-white p-5 text-ink" onClick={(e) => e.stopPropagation()}>
              <h2 className="mb-2 font-display text-lg font-semibold">Seen by {viewers.length}</h2>
              {viewers.length === 0 && <p className="text-sm text-stone-500">No views yet.</p>}
              {viewers.map((v) => <p key={v.id} className="flex justify-between border-b border-stone-100 py-2 text-sm"><span>{v.name}</span><span className="text-stone-400">{timeAgo(v.at)}</span></p>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
