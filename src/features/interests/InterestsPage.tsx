import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { myInterests, respondInterest, withdrawInterest, type Interest } from "../../services/interestService";
import { getCards, type ProfileCard } from "../../services/cardService";
import { setShortlisted, shortlistIds } from "../../services/socialService";
import ProfileCardView from "../../components/ProfileCardView";
import { btnSmall, btnSmallOutline } from "../../components/ui/styles";
import MatchModal from "../../components/MatchModal";
import { useVerifyGate } from "../../components/VerifyGate";
import Icon from "../../components/ui/Icon";
import { CardSkeletons, EmptyState, PageLoader } from "../../components/ui/Feedback";


type Tab = "received" | "sent" | "connected" | "shortlist";

export default function InterestsPage() {
  const { user } = useAuth();
  const { requireFace } = useVerifyGate();
  const [tab, setTab] = useState<Tab>("received");
  const [list, setList] = useState<Interest[]>([]);
  const [shortIds, setShortIds] = useState<string[]>([]);
  const [cards, setCards] = useState<Map<string, ProfileCard>>(new Map());
  const [error, setError] = useState("");
  const [matchWith, setMatchWith] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [ints, sl] = await Promise.all([myInterests(user.id), shortlistIds(user.id)]);
    setList(ints); setShortIds(sl);
    const ids = new Set<string>(sl);
    ints.forEach((i) => ids.add(i.from_uid === user.id ? i.to_uid : i.from_uid));
    const cs = await getCards([...ids]);
    setCards(new Map(cs.map((c) => [c.id, c])));
  }, [user]);

  useEffect(() => { load(); }, [load]);
  if (!user) return null;

  const other = (i: Interest) => (i.from_uid === user.id ? i.to_uid : i.from_uid);
  const received = list.filter((i) => i.to_uid === user.id && i.status === "pending");
  const sent = list.filter((i) => i.from_uid === user.id && i.status !== "accepted");
  const connected = list.filter((i) => i.status === "accepted");
  const act = async (fn: () => Promise<unknown>) => { setError(""); try { await fn(); await load(); } catch (e: any) { setError(e.message); } };

  const tabBtn = (t: Tab, label: string, n: number) => (
    <button onClick={() => setTab(t)}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? "bg-brand-600 text-white" : "bg-white text-gray-600 ring-1 ring-black/10"}`}>
      {label} ({n})
    </button>
  );

  const rowFor = (i: Interest, actions: React.ReactNode) => {
    const c = cards.get(other(i));
    if (!c) return null;
    return (
      <div key={i.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
        <div className="w-24 shrink-0 sm:w-28"><ProfileCardView card={c} /></div>
        <div className="flex flex-1 flex-col justify-between">
          <div>
            {i.message && <p className="rounded bg-brand-50 p-2 text-sm text-gray-700">“{i.message}”</p>}
            <p className="mt-1 text-xs text-gray-400">{new Date(i.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabBtn("received", "Received", received.length)}
        {tabBtn("sent", "Sent", sent.length)}
        {tabBtn("connected", "Connected", connected.length)}
        {tabBtn("shortlist", "Shortlist", shortIds.length)}
      </div>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {tab === "received" && received.map((i) => rowFor(i, <>
          <button className={btnSmall} onClick={() => requireFace("accept interests") && act(async () => { await respondInterest(i.id, true); setMatchWith(other(i)); })}>Accept</button>
          <button className={btnSmallOutline} onClick={() => requireFace("respond to interests") && act(() => respondInterest(i.id, false))}>Decline</button>
        </>))}
        {tab === "sent" && sent.map((i) => rowFor(i, <>
          <span className="text-sm text-gray-500">{i.status === "declined" ? "Declined" : "Waiting for reply"}</span>
          {i.status === "pending" && <button className={btnSmallOutline} onClick={() => act(() => withdrawInterest(i.id))}>Withdraw</button>}
        </>))}
        {tab === "connected" && connected.map((i) => rowFor(i, <>
          <Link to={`/messages/${other(i)}`} className={btnSmall}><Icon name="chat" size={16} />Message</Link>
          <Link to={`/p/${other(i)}`} className={btnSmallOutline}>View profile</Link>
        </>))}
        {tab === "shortlist" && shortIds.map((id) => {
          const c = cards.get(id);
          return c ? <div key={id} className="max-w-[220px]">
            <ProfileCardView card={c} shortlisted onToggleShortlist={() => act(() => setShortlisted(user.id, id, false))} />
          </div> : null;
        })}
      </div>
      {((tab === "received" && !received.length) || (tab === "sent" && !sent.length) ||
        (tab === "connected" && !connected.length) || (tab === "shortlist" && !shortIds.length)) && (
        <EmptyState icon="mail" title="Nothing here yet" text="Interests you send and receive will appear in this list." />
      )}
      {matchWith && cards.get(matchWith) && (
        <MatchModal name={cards.get(matchWith)!.full_name} photo={cards.get(matchWith)!.photoUrl} chatTo={matchWith} onClose={() => setMatchWith(null)} />
      )}
    </div>
  );
}
