import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Icon from "./ui/Icon";
import ReportSheet from "./ReportSheet";
import { input } from "./ui/styles";
import {
  addComment, deleteComment, deletePost, listComments, recordFeedback, reportPost, setLiked, setSaved,
  type Comment, type Post,
} from "../services/postService";
import { blockUser } from "../services/socialService";
import SendToChatSheet from "./chat/SendToChatSheet";
import { timeAgo } from "../utils/time";

function CaptionText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /#[\p{L}\p{N}\p{M}_]{2,30}/gu;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tag = m[0].slice(1).toLowerCase();
    parts.push(<Link key={i++} to={`/dashboard?tag=${encodeURIComponent(tag)}`} className="font-medium text-brand-600 hover:underline">{m[0]}</Link>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <p className="whitespace-pre-line text-sm leading-relaxed">{parts}</p>;
}

export default function PostCard({ post, me, onDeleted }: { post: Post; me: string; onDeleted?: (id: string) => void }) {
  const [liked, setLikedState] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [saved, setSavedState] = useState(post.saved);
  const [commentCount, setCommentCount] = useState(post.comments);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [idx, setIdx] = useState(0);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [sendChat, setSendChat] = useState(false);
  const mine = post.user_id === me;
  const place = [post.location, post.district].filter(Boolean).join(", ");
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2200); };

  async function like() {
    const on = !liked;
    setLikedState(on); setLikes((n) => n + (on ? 1 : -1));
    try { await setLiked(me, post.id, on); } catch { setLikedState(!on); setLikes((n) => n + (on ? -1 : 1)); }
  }
  async function save() {
    const on = !saved;
    setSavedState(on);
    try { await setSaved(me, post.id, on); say(on ? "Saved" : "Removed from saved"); } catch { setSavedState(!on); }
  }
  async function share() {
    const url = `${location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${post.author.full_name} on Matrimony LK`, url });
      else { await navigator.clipboard.writeText(url); say("Link copied"); }
    } catch { /* cancelled */ }
  }
  async function toggleComments() {
    setOpen(!open);
    if (!comments) setComments(await listComments(post.id));
  }
  async function send() {
    if (!text.trim()) return;
    setErr("");
    try {
      await addComment(me, post.id, text);
      setText(""); setCommentCount((n) => n + 1); setComments(await listComments(post.id));
    } catch (e: any) { setErr(e.message); }
  }
  const feedback = async (kind: "hidden" | "not_interested") => {
    setMenu(false);
    try { await recordFeedback(me, post, kind); onDeleted?.(post.id); } catch (e: any) { say(e.message); }
  };

  const item = "flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-stone-50";

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-900/5">
      <header className="flex items-center gap-3 p-3">
        <Link to={`/p/${post.author.id}`} className="shrink-0 rounded-full bg-gradient-to-tr from-brand-600 via-brand-500 to-brand-200 p-[2px]">
          {post.author.photoUrl ? (
            <img src={post.author.photoUrl} alt="" className="h-10 w-10 rounded-full border-2 border-white object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-brand-100 font-display text-brand-600">{post.author.full_name[0]}</span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/p/${post.author.id}`} className="flex items-center gap-1 text-sm font-semibold hover:underline">
            <span className="truncate">{post.author.full_name}</span>
            {post.author.face_verified && <Icon name="shieldCheck" size={15} className="shrink-0 text-emerald-600" />}
          </Link>
          <p className="flex items-center gap-1 truncate text-xs text-stone-500">
            {timeAgo(post.created_at)}{place && <> · <Icon name="mapPin" size={12} />{place}</>}
            {post.visibility !== "members" && <> · <Icon name="lock" size={12} />{post.visibility === "matches" ? "Matches" : "Only me"}</>}
          </p>
        </div>
        <div className="relative">
          <button aria-label="More" onClick={() => setMenu(!menu)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-stone-100"><Icon name="dots" size={20} /></button>
          {menu && (
            <div className="absolute right-0 top-9 z-10 w-52 overflow-hidden rounded-xl bg-white text-sm shadow-lg ring-1 ring-stone-900/10">
              <button className={item} onClick={() => { setMenu(false); save(); }}><Icon name="bookmark" size={16} />{saved ? "Unsave" : "Save"}</button>
              <button className={item} onClick={() => { setMenu(false); share(); }}><Icon name="share" size={16} />Share link</button>
              <button className={item} onClick={() => { setMenu(false); setSendChat(true); }}><Icon name="send" size={16} />Send to chat</button>
              {mine ? (
                <button className={`${item} text-red-600`} onClick={async () => {
                  setMenu(false);
                  if (confirm("Delete this post?")) { await deletePost(post); onDeleted?.(post.id); }
                }}><Icon name="trash" size={16} />Delete</button>
              ) : (
                <>
                  <button className={item} onClick={() => feedback("not_interested")}><Icon name="eyeOff" size={16} />Not interested</button>
                  <button className={item} onClick={() => feedback("hidden")}><Icon name="x" size={16} />Hide post</button>
                  <button className={item} onClick={() => { setMenu(false); setReport(true); }}><Icon name="flag" size={16} />Report</button>
                  <button className={`${item} text-red-600`} onClick={async () => {
                    setMenu(false);
                    if (confirm(`Block ${post.author.full_name}? You will no longer see each other.`)) {
                      await blockUser(me, post.author.id, post.author.full_name); onDeleted?.(post.id);
                    }
                  }}><Icon name="ban" size={16} />Block</button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="relative bg-stone-100">
        <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
          {post.images.map((src) => (
            <img key={src} src={src} alt="" loading="lazy" className="aspect-[4/5] w-full shrink-0 snap-center object-cover" />
          ))}
        </div>
        {post.images.length > 1 && (
          <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-medium text-white">{idx + 1}/{post.images.length}</span>
        )}
        {toast && <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/75 px-4 py-1.5 text-sm text-white">{toast}</span>}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center gap-4">
          <button onClick={like} aria-label={liked ? "Unlike" : "Like"} className={`transition active:scale-90 ${liked ? "text-brand-600" : "text-ink"}`}><Icon name="heart" size={26} filled={liked} /></button>
          {(post.allow_comments || mine) && <button onClick={toggleComments} aria-label="Comments"><Icon name="chat" size={25} /></button>}
          <button onClick={share} aria-label="Share"><Icon name="share" size={25} /></button>
          <button onClick={save} aria-label={saved ? "Unsave" : "Save"} className={`ml-auto ${saved ? "text-brand-600" : "text-ink"}`}><Icon name="bookmark" size={25} filled={saved} /></button>
        </div>
        {(post.show_likes || mine) && <p className="text-sm font-semibold">{likes} {likes === 1 ? "like" : "likes"}</p>}
        {post.caption && <CaptionText text={post.caption} />}
        {post.hashtags.length > 0 && !post.caption?.includes("#") && (
          <p className="text-sm">{post.hashtags.map((t) => <Link key={t} to={`/dashboard?tag=${t}`} className="mr-2 text-brand-600">#{t}</Link>)}</p>
        )}
        {post.allow_comments || mine ? (
          <button onClick={toggleComments} className="text-sm text-stone-500">
            {commentCount === 0 ? "Add a comment" : open ? "Hide comments" : `View all ${commentCount} comments`}
          </button>
        ) : <p className="text-sm text-stone-400">Comments are turned off</p>}

        {open && (
          <div className="space-y-2 border-t border-stone-100 pt-2">
            {(comments ?? []).map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
                <p><b>{c.author?.full_name ?? "Member"}</b> {c.body}</p>
                {(c.user_id === me || mine) && (
                  <button aria-label="Delete comment" className="text-stone-400" onClick={async () => {
                    await deleteComment(c.id); setCommentCount((n) => Math.max(0, n - 1)); setComments(await listComments(post.id));
                  }}><Icon name="x" size={14} /></button>
                )}
              </div>
            ))}
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex gap-2">
              <input className={`${input} !py-2`} placeholder="Write a comment" maxLength={300} value={text}
                onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
              <button onClick={send} className="rounded-xl bg-brand-600 px-3 text-white" aria-label="Send comment"><Icon name="send" size={17} /></button>
            </div>
          </div>
        )}
      </div>

      {sendChat && <SendToChatSheet me={me} postId={post.id} onClose={() => setSendChat(false)} onSent={(n) => { setSendChat(false); say(`Sent to ${n}`); }} />}

      {report && (
        <ReportSheet title="Report this post" onClose={() => setReport(false)}
          onSubmit={async (r, d) => { await reportPost(me, post, r, d); setReport(false); say("Report sent"); }} />
      )}
    </article>
  );
}
