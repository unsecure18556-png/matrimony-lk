import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { chatMediaUrl, type Message } from "../../services/chatService";
import { fetchPost, type Post } from "../../services/postService";
import Icon from "../ui/Icon";
import Ticks from "./Ticks";
import VoicePlayer from "./VoicePlayer";

function linkify(text: string, mine: boolean): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /((?:https?:\/\/|www\.)[^\s]+)/gi;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const href = m[1].startsWith("http") ? m[1] : `https://${m[1]}`;
    parts.push(<a key={i++} href={href} target="_blank" rel="noopener noreferrer nofollow" className={`underline ${mine ? "text-white" : "text-brand-600"}`}>{m[1]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function MessageBubble({ m, me, onOpenImage }: { m: Message; me: string; onOpenImage: (url: string) => void }) {
  const mine = m.from_uid === me;
  const [url, setUrl] = useState<string | null>(null);
  const [post, setPost] = useState<Post | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    if (m.media_path) chatMediaUrl(m.media_path).then((u) => alive && setUrl(u));
    if (m.kind === "post" && m.post_id) fetchPost(me, m.post_id).then((p) => alive && setPost(p));
    return () => { alive = false; };
  }, [m.media_path, m.kind, m.post_id, me]);

  const time = new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const media = m.kind === "image" || m.kind === "video";

  return (
    <div className={`flex ${mine ? "justify-end" : ""}`}>
      <div className={`max-w-[78%] overflow-hidden rounded-2xl text-sm ${media || m.kind === "post" ? "p-1" : "px-3 py-2"} ${mine ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md bg-stone-100"}`}>
        {m.kind === "text" && <p className="whitespace-pre-wrap break-words">{linkify(m.body, mine)}</p>}

        {m.kind === "image" && (url
          ? <button onClick={() => onOpenImage(url)}><img src={url} alt="" className="max-h-72 rounded-xl object-cover" /></button>
          : <div className="h-40 w-52 animate-pulse rounded-xl bg-black/10" />)}

        {m.kind === "video" && (url
          ? <video src={url} controls playsInline preload="metadata" className="max-h-72 rounded-xl" />
          : <div className="h-40 w-52 animate-pulse rounded-xl bg-black/10" />)}

        {m.kind === "voice" && <VoicePlayer src={url} duration={m.duration_s ?? 0} mine={mine} />}

        {m.kind === "post" && (post === undefined ? <div className="h-32 w-48 animate-pulse rounded-xl bg-black/10" /> : post ? (
          <Link to={`/post/${post.id}`} className={`block w-52 overflow-hidden rounded-xl ${mine ? "bg-white/15" : "bg-white"}`}>
            {post.images[0] && <img src={post.images[0]} alt="" className="h-36 w-full object-cover" />}
            <span className="block p-2 text-xs"><b>{post.author.full_name}</b><span className="line-clamp-2 block opacity-80">{post.caption ?? "Photo post"}</span></span>
          </Link>
        ) : <p className="flex items-center gap-1.5 px-2 py-1 text-xs opacity-80"><Icon name="image" size={14} />Post is no longer available</p>)}

        <div className={`flex items-center justify-end gap-1 text-[10px] ${media ? "px-2 pb-1 pt-0.5" : "mt-0.5"} ${mine ? "text-white/80" : "text-stone-500"}`}>
          <span>{time}</span>{mine && <Ticks seen={!!m.read_at} />}
        </div>
      </div>
    </div>
  );
}
