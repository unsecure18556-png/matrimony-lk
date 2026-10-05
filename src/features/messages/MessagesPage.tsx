import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { myInterests } from "../../services/interestService";
import { getCards, type ProfileCard } from "../../services/cardService";
import {
  conversationSummaries, getThread, markRead, sendMessage, subscribeIncoming, type Message,
} from "../../services/chatService";
import { input } from "../../components/ui/styles";
import Icon from "../../components/ui/Icon";

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
  const endRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    if (!user) return;
    const ints = (await myInterests(user.id)).filter((i) => i.status === "accepted");
    const ids = ints.map((i) => (i.from_uid === user.id ? i.to_uid : i.from_uid));
    setPartners(await getCards(ids));
    const s = await conversationSummaries(user.id, ids);
    setLast(s.last); setUnread(s.unread);
  }, [user]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (!user || !otherId) return;
    getThread(user.id, otherId).then(setThread);
    markRead(otherId);
  }, [user, otherId]);

  useEffect(() => {
    if (!user) return;
    return subscribeIncoming(user.id, (m) => {
      if (m.from_uid === otherId) { setThread((t) => [...t, m]); markRead(m.from_uid); }
      loadList();
    });
  }, [user, otherId, loadList]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!user || !otherId || !text.trim()) return;
    setError("");
    try {
      const m = await sendMessage(user.id, otherId, text.trim());
      setThread((t) => [...t, m]); setText(""); loadList();
    } catch (err: any) { setError(err.message); }
  }

  if (!user) return null;
  const current = partners.find((p) => p.id === otherId);

  return (
    <div className="grid h-[calc(100dvh-10rem)] gap-3 md:h-[calc(100vh-110px)] md:grid-cols-[300px_1fr]">
      <aside className={`overflow-y-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/5 ${otherId ? "hidden md:block" : ""}`}>
        <h2 className="p-2 font-display text-xl font-semibold">Messages</h2>
        {partners.length === 0 && (
          <p className="p-3 text-sm text-gray-500">You can chat once an interest is accepted. <Link className="text-brand-600" to="/search">Find profiles</Link></p>
        )}
        {partners.map((p) => (
          <button key={p.id} onClick={() => nav(`/messages/${p.id}`)}
            className={`flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-brand-50 ${p.id === otherId ? "bg-brand-50" : ""}`}>
            {p.photoUrl ? <img src={p.photoUrl} className="h-11 w-11 rounded-full object-cover" alt="" />
              : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-500">{p.full_name[0]}</div>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.full_name}</p>
              <p className="truncate text-xs text-gray-500">{last.get(p.id)?.body ?? "Say hello"}</p>
            </div>
            {(unread.get(p.id) ?? 0) > 0 && (
              <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{unread.get(p.id)}</span>
            )}
          </button>
        ))}
      </aside>

      <section className={`flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-black/5 ${otherId ? "" : "hidden md:flex"}`}>
        {!current ? (
          <div className="m-auto flex flex-col items-center gap-2 text-stone-400"><Icon name="chat" size={36} /><span>Select a conversation</span></div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b p-3">
              <button className="md:hidden" onClick={() => nav("/messages")}><Icon name="arrowLeft" size={20} /></button>
              <Link to={`/p/${current.id}`} className="font-semibold hover:text-brand-700">{current.full_name}</Link>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {thread.map((m) => (
                <div key={m.id} className={`flex ${m.from_uid === user.id ? "justify-end" : ""}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.from_uid === user.id ? "bg-brand-600 text-white" : "bg-gray-100"}`}>
                    {m.body}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <form onSubmit={onSend} className="border-t p-3">
              {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <input className={input} placeholder="Type a message" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
                <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 font-semibold text-white"><Icon name="send" size={16} />Send</button>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">Never send money or share bank details. Links are blocked for your safety.</p>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
