import { useRef, useState } from "react";
import Icon from "../ui/Icon";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function VoicePlayer({ src, duration, mine }: { src: string | null; duration: number; mine: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const total = duration || 1;

  function toggle() {
    const a = ref.current; if (!a || !src) return;
    if (playing) { a.pause(); setPlaying(false); } else { a.play().then(() => setPlaying(true)).catch(() => {}); }
  }
  return (
    <div className="flex w-52 items-center gap-2.5">
      <button onClick={toggle} disabled={!src} aria-label={playing ? "Pause" : "Play"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${mine ? "bg-white/25 text-white" : "bg-brand-600 text-white"} disabled:opacity-50`}>
        <Icon name={playing ? "pause" : "play"} size={16} filled={!playing} strokeWidth={2.4} />
      </button>
      <div className="flex-1">
        <div className={`h-1.5 overflow-hidden rounded-full ${mine ? "bg-white/30" : "bg-stone-300"}`}>
          <div className={`h-full rounded-full ${mine ? "bg-white" : "bg-brand-600"}`} style={{ width: `${Math.min(100, (pos / total) * 100)}%` }} />
        </div>
        <p className="mt-1 text-[11px] opacity-80">{fmt(playing || pos > 0 ? pos : total)}</p>
      </div>
      {src && <audio ref={ref} src={src} preload="metadata" onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)} onEnded={() => { setPlaying(false); setPos(0); }} />}
    </div>
  );
}
