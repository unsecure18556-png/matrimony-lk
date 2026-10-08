import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { myInterests } from "../../services/interestService";
import { getCards, type ProfileCard } from "../../services/cardService";
import {
  conversationSummaries, findBadLink, getThread, markRead, previewOf, sendImage, sendMessage, sendPostShare,
  sendVideo, sendVoice, subscribeIncoming, subscribeReceipts, type Message,
} from "../../services/chatService";
import { listAllowedDomains } from "../../services/brandingService";
import { MAX_VOICE_SECONDS, useVoiceRecorder } from "../../hooks/useVoiceRecorder";
import MessageBubble from "../../components/chat/MessageBubble";
import AttachSheet, { type AttachKind } from "../../components/chat/AttachSheet";
import PostPickerSheet from "../../components/chat/PostPickerSheet";
import Ticks from "../../components/chat/Ticks";
import Icon from "../../components/ui/Icon";
import { input } from "../../components/ui/styles";

export default function MessagesPage() {
  const { user } = useAuth();
  const { otherId } = useParams();
  const nav = useNavigate();
  const [partners, setPartners] = useState<ProfileCard[]>([]);
  const [last, setLast] = useState<Map<string, Message>>(new Map());
  const [unread, setUnread] = useState<Map<string, number>>(new Map());
  const [thread, setThread] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [attach, setAttach] = useState(false);
  const [picker, setPicker] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder();

  const loadList = useCallback(async () => {
    if (!user) return;
    const ints = (await myInterests(user.id)).filter((i) => i.status === "accepted");
    const ids = ints.map((i) => (i.from_uid === user.id ? i.to_uid : i.from_uid));
    setPartners(await getCards(ids));
    const s = await conversationSummaries(user.id, ids);
    setLast(s.last); setUnread(s.unread);
  }, [user]);

  useEffect(() => { loadList(); listAllowedDomains().then(setDomains).catch(() => {}); }, [loadList]);

  // opening a chat: load messages, mark them seen (sender gets double ticks), clear the badge
  useEffect(() => {
    if (!user || !otherId) return;
    setThread([]);
    getThread(user.id, otherId).then(setThread);
    markRead(otherId).then(loadList);
  }, [user, otherId, loadList]);

  // realtime: new messages to me, and "seen" updates on messages I sent
  useEffect(() => {
    if (!user) return;
    const offIn = subscribeIncoming(user.id, (m) => {
      if (m.from_uid === otherId) { setThread((t) => (t.some((x) => x.id === m.id) ? t : [...t, m])); markRead(m.from_uid).then(loadList); }
      else loadList();
    });
    const offSeen = subscribeReceipts(user.id, (m) => setThread((t) => t.map((x) => (x.id === m.id ? { ...x, read_at: m.read_at } : x))));
    return () => { offIn(); offSeen(); };
  }, [user, otherId, loadList]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread.length]);
  useEffect(() => { if (voice.seconds >= MAX_VOICE_SECONDS) sendRecording(); /* eslint-disable-next-line */ }, [voice.seconds]);

  async function deliver(fn: () => Promise<Message>, label = "") {
    setError(""); setBusy(label);
    try { const m = await fn(); setThread((t) => [...t, m]); loadList(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(""); }
  }

  function onSend(e: FormEvent) {
    e.preventDefault();
    if (!user || !otherId || !text.trim()) return;
    const bad = findBadLink(text, domains);
    if (bad) return setError(`Links from ${bad} cannot be shared. Only verified websites are allowed.`);
    const body = text.trim();
    setText("");
    deliver(() => sendMessage(user.id, otherId, body));
  }

  async function startRecording() {
    setError("");
    try { await voice.start(); } catch (e: any) { setError(e.message); }
  }
  async function sendRecording() {
    if (!user || !otherId) return;
    const r = await voice.stop();
    if (r) deliver(() => sendVoice(user.id, otherId, r.blob, r.seconds), "Sending voice message...");
  }

  function onFile(kind: "photo" | "video", files: FileList | null) {
    const f = files?.[0];
    if (!f || !user || !otherId) return;
    deliver(() => (kind === "photo" ? sendImage(user.id, otherId, f) : sendVideo(user.id, otherId, f)), kind === "photo" ? "Sending photo..." : "Sending video...");
  }

  function pick(k: AttachKind) {
    setAttach(false);
    if (k === "photo") photoRef.current?.click();
    if (k === "camera") cameraRef.current?.click();
    if (k === "video") videoRef.current?.click();
    if (k === "post") setPicker(true);
  }

  if (!user) return null;
  const current = partners.find((p) => p.id === otherId);
  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="grid h-[calc(100dvh-10rem)] gap-3 md:h-[calc(100vh-110px)] md:grid-cols-[300px_1fr]">
      <aside className={`overflow-y-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-stone-900/5 ${otherId ? "hidden md:block" : ""}`}>
        <h2 className="p-2 font-display text-xl font-semibold">Messages</h2>
        {partners.length === 0 && (
          <p className="p-3 text-sm text-stone-500">You can chat once an interest is accepted. <Link className="text-brand-600" to="/discover">Find profiles</Link></p>
        )}
        {partners.map((p) => {
          const l = last.get(p.id); const n = unread.get(p.id) ?? 0;
          return (
            <button key={p.id} onClick={() => nav(`/messages/${p.id}`)}
              className={`flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-brand-50 ${p.id === otherId ? "bg-brand-50" : ""}`}>
              {p.photoUrl ? <img src={p.photoUrl} className="h-11 w-11 rounded-full object-cover" alt="" />
                : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-500">{p.full_name[0]}</div>}
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${n ? "font-bold" : "font-semibold"}`}>{p.full_name}</p>
                <p className={`flex items-center gap-1 truncate text-xs ${n ? "font-semibold text-ink" : "text-stone-500"}`}>
                  {l && l.from_uid === user.id && <Ticks seen={!!l.read_at} />}
                  <span className="truncate">{l ? previewOf(l) : "Say hello"}</span>
                </p>
              </div>
              {n > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{n}</span>}
            </button>
          );
        })}
      </aside>

      <section className={`flex min-h-0 flex-col rounded-2xl bg-white shadow-sm ring-1 ring-stone-900/5 ${otherId ? "" : "hidden md:flex"}`}>
        {!current ? (
          <div className="m-auto flex flex-col items-center gap-2 text-stone-400"><Icon name="chat" size={36} /><span>Select a conversation</span></div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-stone-100 p-3">
              <button className="md:hidden" onClick={() => nav("/messages")} aria-label="Back"><Icon name="arrowLeft" size={20} /></button>
              <Link to={`/p/${current.id}`} className="font-semibold hover:text-brand-700">{current.full_name}</Link>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {thread.map((m) => <MessageBubble key={m.id} m={m} me={user.id} onOpenImage={setViewer} />)}
              <div ref={endRef} />
            </div>

            <div className="border-t border-stone-100 p-3">
              {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
              {busy && <p className="mb-2 text-xs text-brand-700">{busy}</p>}
              {voice.recording ? (
                <div className="flex items-center gap-3">
                  <button onClick={voice.cancel} aria-label="Cancel recording" className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-red-600"><Icon name="trash" size={20} /></button>
                  <div className="flex flex-1 items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />Recording {mm(voice.seconds)}
                  </div>
                  <button onClick={sendRecording} aria-label="Send voice message" className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white"><Icon name="send" size={19} /></button>
                </div>
              ) : (
                <form onSubmit={onSend} className="flex items-center gap-2">
                  <button type="button" onClick={() => setAttach(true)} aria-label="Attach" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stone-100"><Icon name="paperclip" size={20} /></button>
                  <input className={input} placeholder="Type a message" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
                  {text.trim() ? (
                    <button aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><Icon name="send" size={19} /></button>
                  ) : (
                    <button type="button" onClick={startRecording} aria-label="Record voice message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><Icon name="mic" size={20} /></button>
                  )}
                </form>
              )}
              <p className="mt-1 text-[11px] text-stone-400">Never send money or bank details. Only verified website links are allowed.</p>
            </div>
          </>
        )}
      </section>

      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { onFile("photo", e.target.files); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFile("photo", e.target.files); e.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/*" hidden onChange={(e) => { onFile("video", e.target.files); e.target.value = ""; }} />

      {attach && <AttachSheet onPick={pick} onClose={() => setAttach(false)} />}
      {picker && otherId && (
        <PostPickerSheet me={user.id} onClose={() => setPicker(false)}
          onSelect={(p) => { setPicker(false); deliver(() => sendPostShare(user.id, otherId, p.id), "Sharing post..."); }} />
      )}
      {viewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" onClick={() => setViewer(null)}>
          <button aria-label="Close" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"><Icon name="x" size={22} /></button>
          <img src={viewer} alt="" className="max-h-[90dvh] max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
