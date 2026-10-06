import { useEffect, useState } from "react";
import { myInterests } from "../../services/interestService";
import { getCards, type ProfileCard } from "../../services/cardService";
import { sendPostShare } from "../../services/chatService";
import Icon from "../ui/Icon";

export default function SendToChatSheet({ me, postId, onClose, onSent }: { me: string; postId: string; onClose: () => void; onSent: (name: string) => void }) {
  const [people, setPeople] = useState<ProfileCard[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    myInterests(me).then(async (l) => {
      const ids = l.filter((i) => i.status === "accepted").map((i) => (i.from_uid === me ? i.to_uid : i.from_uid));
      setPeople(await getCards(ids));
    });
  }, [me]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[70dvh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Send to chat</h2>
          <button aria-label="Close" onClick={onClose}><Icon name="x" size={22} /></button></div>
        {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
        {people === null ? <p className="py-6 text-center text-sm text-stone-500">Loading...</p> : people.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-500">You can send posts to your mutual matches. None yet.</p>
        ) : people.map((p) => (
          <button key={p.id} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-stone-50"
            onClick={async () => { try { await sendPostShare(me, p.id, postId); onSent(p.full_name); } catch (e: any) { setErr(e.message); } }}>
            {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-display text-brand-600">{p.full_name[0]}</span>}
            <span className="flex-1 font-medium">{p.full_name}</span><Icon name="send" size={17} className="text-brand-600" />
          </button>
        ))}
      </div>
    </div>
  );
}
