import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { findBestMatches } from "../../services/matchService";
import ProfileCardView from "../../components/ProfileCardView";
import { CardSkeletons, EmptyState } from "../../components/ui/Feedback";
import Icon, { type IconName } from "../../components/ui/Icon";

function Ring({ pct }: { pct: number }) {
  const c = 2 * Math.PI * 30;
  return (
    <svg width="84" height="84" viewBox="0 0 72 72" className="shrink-0 -rotate-90">
      <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="7" />
      <circle cx="36" cy="36" r="30" fill="none" stroke="#ecc656" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      <text x="36" y="36" transform="rotate(90 36 36)" textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize="16" fontWeight="700">{pct}%</text>
    </svg>
  );
}

export default function HomePage() {
  const { profile } = useAuth();
  const [top, setTop] = useState<Awaited<ReturnType<typeof findBestMatches>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) findBestMatches(profile, 4).then(setTop).finally(() => setLoading(false));
  }, [profile]);

  if (!profile) return null;
  const first = profile.full_name.split(" ")[0];

  const tile = (to: string, icon: IconName, label: string) => (
    <Link to={to} className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-center text-sm font-medium shadow-sm ring-1 ring-stone-900/5 transition hover:-translate-y-0.5 hover:shadow-md">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name={icon} size={22} /></span>
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-6 text-white md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold-400/20 blur-3xl" />
        <svg className="pointer-events-none absolute -bottom-10 right-4 opacity-[.12]" width="220" height="220" viewBox="0 0 100 100" fill="none" stroke="#ecc656" strokeWidth=".8">
          <circle cx="38" cy="50" r="30" /><circle cx="62" cy="50" r="30" />
        </svg>
        <div className="relative flex items-center gap-5">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-brand-200">Welcome back</p>
            <h1 className="font-display text-3xl font-semibold md:text-4xl">{first}</h1>
            <p className="mt-2 text-sm text-brand-100">
              {profile.completion_score >= 100 ? "Your profile is complete." : "A complete profile gets more responses."}
            </p>
            {profile.completion_score < 100 && (
              <Link to="/onboarding" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/25">
                Complete profile <Icon name="arrowRight" size={15} />
              </Link>
            )}
          </div>
          <Ring pct={profile.completion_score} />
        </div>
      </section>

      <section className="grid grid-cols-4 gap-3">
        {tile("/search", "search", "Search")}
        {tile("/matches", "sparkles", "Matches")}
        {tile("/interests", "mail", "Interests")}
        {tile("/messages", "chat", "Chat")}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold">Your best matches</h2>
          <Link to="/matches" className="flex items-center gap-1 text-sm font-medium text-brand-700">See all <Icon name="chevronRight" size={16} /></Link>
        </div>
        {loading ? <CardSkeletons /> : top.length === 0 ? (
          <EmptyState icon="sparkles" title="No matches yet" text="As more verified members join, your best matches will appear here." />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {top.map(({ card, sc }) => <ProfileCardView key={card.id} card={card} sc={sc} />)}
          </div>
        )}
      </section>
    </div>
  );
}
