import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { findBestMatches } from "../../services/matchService";
import { faceSuggestions } from "../../services/faceService";
import { myInterests } from "../../services/interestService";
import { getCards, type ProfileCard } from "../../services/cardService";
import { setShortlisted, shortlistIds } from "../../services/socialService";
import ProfileCardView from "../../components/ProfileCardView";
import InterestsPage from "../interests/InterestsPage";
import Icon from "../../components/ui/Icon";
import { CardSkeletons, EmptyState } from "../../components/ui/Feedback";
import { panel } from "../../components/ui/styles";

type Tab = "recommended" | "mutual" | "interests";

export default function MatchesPage() {
  const { user, profile } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") as Tab) || "recommended";
  const [faces, setFaces] = useState(false);
  const [best, setBest] = useState<Awaited<ReturnType<typeof findBestMatches>>>([]);
  const [similar, setSimilar] = useState<ProfileCard[]>([]);
  const [mutual, setMutual] = useState<ProfileCard[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!profile || !user) return;
    shortlistIds(user.id).then((ids) => setSaved(new Set(ids)));
    findBestMatches(profile, 40).then(setBest).finally(() => setLoading(false));
    myInterests(user.id).then(async (l) => {
      const ids = l.filter((i) => i.status === "accepted").map((i) => (i.from_uid === user.id ? i.to_uid : i.from_uid));
      setMutual(await getCards(ids));
    });
  }, [profile, user]);

  useEffect(() => {
    if (!faces) return;
    faceSuggestions().then(setSimilar).catch((e) => setErr(e.message));
  }, [faces]);

  async function toggle(id: string) {
    if (!user) return;
    const on = !saved.has(id);
    await setShortlisted(user.id, id, on);
    setSaved((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
    if (faces) faceSuggestions().then(setSimilar).catch(() => {});
  }

  const tabBtn = (t: Tab, label: string) => (
    <button key={t} onClick={() => setSp(t === "recommended" ? {} : { tab: t }, { replace: true })}
      className={`flex-1 border-b-2 py-2.5 text-sm font-semibold transition ${tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-stone-500"}`}>{label}</button>
  );

  return (
    <div className="space-y-4">
      <div className="flex border-b border-stone-200">{tabBtn("recommended", "Recommended")}{tabBtn("mutual", "Mutual Matches")}{tabBtn("interests", "Interests")}</div>

      {tab === "recommended" && (
        <>
          <div className="flex gap-2">
            <button onClick={() => setFaces(false)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${!faces ? "bg-brand-600 text-white" : "bg-white text-stone-600 ring-1 ring-black/10"}`}><Icon name="sparkles" size={16} />Best matches</button>
            <button onClick={() => setFaces(true)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${faces ? "bg-brand-600 text-white" : "bg-white text-stone-600 ring-1 ring-black/10"}`}><Icon name="smile" size={16} />Similar faces</button>
          </div>
          {!faces ? (
            <>
              <p className="text-sm text-stone-500">Ranked by a compatibility score from your preferences, their preferences, background, education, lifestyle and the profiles you shortlist.</p>
              {loading ? <CardSkeletons n={8} /> : best.length === 0 ? <EmptyState icon="sparkles" title="No matches yet" text="Check back as more verified members join." /> : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                  {best.map(({ card, sc }) => (
                    <div key={card.id}>
                      <ProfileCardView card={card} sc={sc} shortlisted={saved.has(card.id)} onToggleShortlist={() => toggle(card.id)} />
                      <details className="mt-1 px-1 text-xs text-stone-500"><summary className="cursor-pointer">Why this match?</summary>
                        <ul className="ml-4 list-disc pt-1">{sc.reasons.map((r) => <li key={r}>{r}</li>)}</ul></details>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className={`${panel} text-sm text-stone-600`}>
                Shortlist a few profiles (tap the heart). We then suggest members with similar facial features. Only members who turned this on are compared, it is appearance only, not compatibility, and nobody can search by uploading a photo.
                {!profile?.face_match_opt_in && <> Want to appear here? <Link className="text-brand-700 underline" to="/settings/face">Turn it on in Settings</Link>.</>}
              </div>
              {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
              {similar.length === 0 ? <EmptyState icon="smile" title="No suggestions yet" text="Shortlist at least one profile that has face matching turned on." /> : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {similar.map((c) => <ProfileCardView key={c.id} card={c} note="Similar to profiles you liked" shortlisted={saved.has(c.id)} onToggleShortlist={() => toggle(c.id)} />)}
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === "mutual" && (mutual.length === 0 ? (
        <EmptyState icon="heart" title="No mutual matches yet" text="When both of you accept each other's interest, the match appears here." />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {mutual.map((c) => (
            <div key={c.id} className="space-y-1.5">
              <ProfileCardView card={c} note="Matched" />
              <div className="flex gap-2"><Link to={`/messages/${c.id}`} className="flex-1 rounded-lg bg-brand-600 py-2 text-center text-xs font-semibold text-white">Message</Link>
                <Link to={`/p/${c.id}`} className="flex-1 rounded-lg bg-stone-100 py-2 text-center text-xs font-semibold">View profile</Link></div>
            </div>
          ))}
        </div>
      ))}

      {tab === "interests" && <InterestsPage />}
    </div>
  );
}
