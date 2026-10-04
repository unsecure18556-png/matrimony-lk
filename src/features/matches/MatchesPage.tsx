import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { findBestMatches } from "../../services/matchService";
import { faceSuggestions } from "../../services/faceService";
import { setShortlisted, shortlistIds } from "../../services/socialService";
import type { ProfileCard } from "../../services/cardService";
import ProfileCardView from "../../components/ProfileCardView";
import { panel } from "../../components/ui/styles";
import Icon from "../../components/ui/Icon";
import { CardSkeletons, EmptyState, PageLoader } from "../../components/ui/Feedback";


type Tab = "best" | "faces";

export default function MatchesPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("best");
  const [best, setBest] = useState<Awaited<ReturnType<typeof findBestMatches>>>([]);
  const [faces, setFaces] = useState<ProfileCard[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [facesLoaded, setFacesLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    shortlistIds(profile.id).then((ids) => setSaved(new Set(ids)));
    findBestMatches(profile, 40).then(setBest).finally(() => setLoading(false));
  }, [profile]);

  useEffect(() => {
    if (tab !== "faces" || facesLoaded) return;
    faceSuggestions().then(setFaces).catch((e) => setError(e.message)).finally(() => setFacesLoaded(true));
  }, [tab, facesLoaded]);

  async function toggle(id: string) {
    if (!profile) return;
    const on = !saved.has(id);
    await setShortlisted(profile.id, id, on);
    setSaved((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
    setFacesLoaded(false); // shortlist changes face suggestions
  }

  const tabBtn = (t: Tab, label: string, icon: "sparkles" | "smile") => (
    <button onClick={() => setTab(t)}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? "bg-brand-600 text-white" : "bg-white text-gray-600 ring-1 ring-black/10"}`}>
      <span className="flex items-center gap-1.5"><Icon name={icon} size={16} />{label}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{tabBtn("best", "Best matches", "sparkles")}{tabBtn("faces", "Similar faces", "smile")}</div>

      {tab === "best" && (
        <>
          <p className="text-sm text-gray-500">
            Ranked by a compatibility score built from your preferences, their preferences, background, education,
            lifestyle, and the profiles you shortlist. This is a scoring model, not a guarantee of compatibility.
          </p>
          {loading ? <CardSkeletons n={8} /> : best.length === 0 ? (
            <EmptyState icon="sparkles" title="No matches yet" text="Check back as more verified members join." />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {best.map(({ card, sc }) => (
                <div key={card.id}>
                  <ProfileCardView card={card} sc={sc} shortlisted={saved.has(card.id)} onToggleShortlist={() => toggle(card.id)} />
                  <details className="mt-1 px-1 text-xs text-gray-500">
                    <summary className="cursor-pointer">Why this match?</summary>
                    <ul className="ml-4 list-disc pt-1">{sc.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  </details>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "faces" && (
        <>
          <div className={`${panel} text-sm text-gray-600`}>
            <p className="font-display text-lg font-semibold text-ink">Face-similarity suggestions (optional)</p>
            <p className="mt-1">
              Shortlist a few profiles you like (tap the heart). We then suggest other members whose facial
              features are similar to those profiles. This only compares members who turned this feature on, it is
              a suggestion based on appearance only, <b>not</b> a compatibility score, and nobody can search by
              uploading someone's photo.
            </p>
            {!profile?.face_verified && (
              <p className="mt-2">Want your own profile to appear here? <Link className="text-brand-600 underline" to="/verify-face">Verify your face</Link> and opt in.</p>
            )}
          </div>
          {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
          {!facesLoaded ? <CardSkeletons n={4} /> : faces.length === 0 ? (
            <EmptyState icon="smile" title="No suggestions yet" text="Shortlist at least one profile that has face matching turned on. Suggestions appear when other members have opted in." />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {faces.map((c) => (
                <ProfileCardView key={c.id} card={c} note="Similar to profiles you liked"
                  shortlisted={saved.has(c.id)} onToggleShortlist={() => toggle(c.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
