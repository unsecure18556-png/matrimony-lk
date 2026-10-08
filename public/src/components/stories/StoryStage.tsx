import type { HTMLAttributes, PointerEvent, RefObject } from "react";
import { cssFilter, type Overlay } from "../../services/storyService";
import Icon from "../ui/Icon";

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  overlay: Overlay; mediaUrl: string; mediaType: "image" | "video";
  stageRef?: RefObject<HTMLDivElement | null>; videoRef?: RefObject<HTMLVideoElement | null>;
  muted?: boolean; onVideoEnded?: () => void; onVideoTime?: (cur: number, dur: number) => void;
  editable?: boolean; selected?: string | null;
  onItemDown?: (kind: "text" | "sticker", id: string, e: PointerEvent<HTMLElement>) => void;
  onRemove?: (kind: "text" | "sticker", id: string) => void;
}

/** One 9:16 canvas used by both the editor and the viewer. Sizes use container units, so it looks the same at any width. */
export default function StoryStage({ overlay, mediaUrl, mediaType, stageRef, videoRef, muted = true, onVideoEnded, onVideoTime, editable, selected, onItemDown, onRemove, className = "", style, ...rest }: Props) {
  const mediaStyle = { filter: cssFilter(overlay), transform: `translate(${overlay.ox}%, ${overlay.oy}%) scale(${overlay.zoom})` };
  const itemCls = `absolute select-none ${editable ? "cursor-grab" : ""}`;
  const frame = (id: string) => (editable && selected === id ? "outline outline-2 outline-dashed outline-white/80 rounded-md" : "");
  const remove = (kind: "text" | "sticker", id: string) => editable && selected === id && onRemove && (
    <button type="button" aria-label="Remove" onPointerDown={(e) => e.stopPropagation()} onClick={() => onRemove(kind, id)}
      className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-ink shadow"><Icon name="x" size={13} strokeWidth={3} /></button>
  );

  return (
    <div ref={stageRef} {...rest} style={{ containerType: "inline-size", ...style }} className={`relative aspect-[9/16] w-full select-none overflow-hidden bg-black ${className}`}>
      {mediaType === "image"
        ? <img src={mediaUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={mediaStyle} />
        : <video ref={videoRef as RefObject<HTMLVideoElement>} src={mediaUrl} playsInline muted={muted} loop={!onVideoEnded} autoPlay
            onEnded={onVideoEnded} onTimeUpdate={(e) => onVideoTime?.(e.currentTarget.currentTime, e.currentTarget.duration)}
            className="absolute inset-0 h-full w-full object-cover" style={mediaStyle} />}

      {overlay.strokes.length > 0 && (
        <svg viewBox="0 0 9 16" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {overlay.strokes.map((s, i) => (
            <path key={i} d={s.pts.map(([x, y], j) => `${j ? "L" : "M"}${(x * 9).toFixed(3)} ${(y * 16).toFixed(3)}`).join(" ") + (s.pts.length === 1 ? " l0.001 0" : "")}
              stroke={s.color} strokeWidth={s.w} />
          ))}
        </svg>
      )}

      {overlay.location && (
        <span className="absolute left-1/2 top-[14%] flex -translate-x-1/2 items-center gap-[1cqw] whitespace-nowrap rounded-full bg-[rgba(255,255,255,.92)] px-[3.5cqw] py-[1.5cqw] text-[3.8cqw] font-semibold text-[#3A1F2B] shadow">
          <Icon name="mapPin" size={14} />{overlay.location}
        </span>
      )}

      {overlay.stickers.map((s) => (
        <div key={s.id} onPointerDown={(e) => onItemDown?.("sticker", s.id, e)} style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, transform: "translate(-50%,-50%)", fontSize: `${s.size}cqw`, lineHeight: 1, touchAction: editable ? "none" : undefined }}
          className={`${itemCls} ${frame(s.id)}`}>{s.emoji}{remove("sticker", s.id)}</div>
      ))}
      {overlay.texts.map((t) => (
        <div key={t.id} onPointerDown={(e) => onItemDown?.("text", t.id, e)}
          style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, transform: "translate(-50%,-50%)", fontSize: `${t.size}cqw`, color: t.color, textShadow: "0 1px 6px rgba(0,0,0,.55)", touchAction: editable ? "none" : undefined }}
          className={`${itemCls} max-w-[90%] whitespace-pre-wrap text-center font-bold leading-tight ${frame(t.id)}`}>{t.text}{remove("text", t.id)}</div>
      ))}
    </div>
  );
}
