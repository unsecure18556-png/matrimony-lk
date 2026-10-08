import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { defaultFilters, PAGE_SIZE, searchProfiles, type Filters } from "../../services/searchService";
import { findBestMatches, scoreMatch } from "../../services/matchService";
import { myInterests, relationWith, respondInterest, sendInterest, type Interest } from "../../services/interestService";
import { hiddenProfileIds, hideProfile } from "../../services/socialService";
import { ageFromDob } from "../../services/profileService";
import type { ProfileCard } from "../../services/cardService";
import Icon from "../../components/ui/Icon";
import MatchModal from "../../components/MatchModal";
import { useVerifyGate } from "../../components/VerifyGate";
import { CardSkeletons, EmptyState } from "../../components/ui/Feedback";
import { SelectField, TextField } from "../../components/ui/Fields";
import { btnPrimary, btnSmallOutline, input } from "../../components/ui/styles";
import { DIETS, DISTRICTS, EDUCATION, ETHNICITIES, INTERESTS, LANGUAGES, MARITAL, RELIGIONS } from "../../utils/constants";

type Mode = "recommended" | "explore";

function DiscoverCard({ card, score, rel, onInterest, onAccept, onHide }: {
  card: ProfileCard; score: number; rel: ReturnType<typeof relationWith>["state"];
  onInterest: () => void; onAccept: () => void; onHide: () => void;
}) {
  const age = card.dob ? ageFromDob(card.dob) : null;
  const btn = "flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition active:scale-[.98]";
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-900/5">
      <Link to={`/p/${card.id}`} className="relative block aspect-[4/5] bg-gradient-to-br from-brand-100 to-gold-50">
        {card.photoUrl ? <img src={card.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-brand-400">
            <span className="font-display text-5xl">{card.full_name[0]}</span>
            {card.hasPhoto && <span className="flex items-center gap-1 text-xs"><Icon name="lock" size={12} />Private</span>}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <p className="flex items-center gap-1 font-display text-lg font-semibold leading-tight">{card.full_name}{age ? `, ${age}` : ""}{card.face_verified && <Icon name="shieldCheck" size={16} className="text-emerald-300" />}</p>
          <p className="truncate text-xs text-white/85">{[card.district, card.occupation].filter(Boolean).join(" · ")}</p>
        </div>
        <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-brand-700">{score}% compatible</span>
      </Link>
      <div className="flex gap-2 p-2.5">
        {rel === "none" && <button className={`${btn} bg-brand-600 text-white`} onClick={onInterest}>Interest</button>}
        {rel === "sent" && <span className={`${btn} bg-stone-100 text-center text-stone-500`}>Interest sent</span>}
        {rel === "received" && <button className={`${btn} bg-brand-600 text-white`} onClick={onAccept}>Accept</button>}
        {rel === "connected" && <Link to={`/messages/${card.id}`} className={`${btn} bg-emerald-700 text-center text-white`}>Matched · Chat</Link>}
        {rel === "declined" && <span className={`${btn} bg-stone-100 text-center text-stone-500`}>Declined</span>}
        {rel !== "connected" && <button className={`${btn} bg-stone-100 text-stone-700`} onClick={onHide}>Not interested</button>}
      </div>
    </article>
  );
}

export default function DiscoverPage() {
  const { user, profile } = useAuth();
  const { requireFace } = useVerifyGate();
  const [mode, setMode] = useState<Mode>("recommended");
  const [filters, setFilters] = useState<Filters>(defaultFilters(profile ?? undefined));
  const [draft, setDraft] = useState<Filters>(filters);
  const [sheet, setSheet] = useState(false);
  const [cards, setCards] = useState<ProfileCard[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [ints, setInts] = useState<Interest[]>([]);
  const [match, setMatch] = useState<ProfileCard | null>(null);

  const refreshInts = useCallback(() => { if (user) myInterests(user.id).then(setInts); }, [user]);

  const run = useCallback(async (m: Mode, f: Filters, p = 0) => {
    if (!profile || !user) return;
    setLoading(true); setErr("");
    try {
      if (m === "recommended") setCards((await findBestMatches(profile, 40)).map((x) => x.card));
      else { const r = await searchProfiles(profile, f, p); setCards((old) => (p === 0 ? r : [...old, ...r])); setPage(p); }
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [profile, user]);

  useEffect(() => { if (user) { hiddenProfileIds(user.id).then(setHidden); refreshInts(); } }, [user, refreshInts]);
  useEffect(() => { run(mode, filters, 0); }, [mode, filters, run]);

  if (!profile || !user) return null;
  const submit = (e: FormEvent) => { e.preventDefault(); setMode("explore"); setFilters({ ...filters }); };
  const setD = <K extends keyof Filters>(k: K, v: Filters[K]) => setDraft((x) => ({ ...x, [k]: v }));
  const shown = cards.filter((c) => !hidden.has(c.id));
  const activeFilters = ["religion", "ethnicity", "district", "education", "marital", "language", "diet", "heightMin", "occupation"].filter((k) => (filters as any)[k]).length + (filters.interests.length ? 1 : 0) + (filters.verifiedOnly ? 1 : 0);

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className={`${input} pl-10`} placeholder="Search name, profession or place" value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        </div>
        <button type="button" onClick={() => { setDraft(filters); setSheet(true); }} aria-label="Advanced filters"
          className="relative flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-white ring-1 ring-stone-300">
          <Icon name="sliders" size={20} />
          {activeFilters > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{activeFilters}</span>}
        </button>
      </form>

      <div className="flex gap-2">
        {(["recommended", "explore"] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === m ? "bg-brand-600 text-white" : "bg-white text-stone-600 ring-1 ring-black/10"}`}>
            {m === "recommended" ? "Recommended" : "Explore"}
          </button>
        ))}
      </div>

      {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {loading && shown.length === 0 ? <CardSkeletons n={8} /> : shown.length === 0 ? (
        <EmptyState icon="search" title="No profiles found" text="Try different words or widen your filters." />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {shown.map((c) => {
            const r = relationWith(ints, user.id, c.id);
            return (
              <DiscoverCard key={c.id} card={c} score={scoreMatch(profile, c).score} rel={r.state}
                onInterest={async () => { if (!requireFace("send interests")) return; try { await sendInterest(user.id, c.id, ""); refreshInts(); } catch (e: any) { setErr(e.message); } }}
                onAccept={async () => { if (!requireFace("accept interests")) return; await respondInterest(r.interest!.id, true); refreshInts(); setMatch(c); }}
                onHide={async () => { await hideProfile(user.id, c.id); setHidden((h) => new Set(h).add(c.id)); }} />
            );
          })}
        </div>
      )}
      {mode === "explore" && !loading && cards.length > 0 && cards.length === (page + 1) * PAGE_SIZE && (
        <div className="text-center"><button className={btnSmallOutline} onClick={() => run("explore", filters, page + 1)}>Load more</button></div>
      )}

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSheet(false)}>
          <div className="max-h-[88dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Advanced filters</h2>
              <button aria-label="Close" onClick={() => setSheet(false)}><Icon name="x" size={22} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Age from" type="number" min={18} max={80} value={draft.ageMin} onChange={(v) => setD("ageMin", Number(v) || 18)} />
              <TextField label="Age to" type="number" min={18} max={80} value={draft.ageMax} onChange={(v) => setD("ageMax", Number(v) || 80)} />
            </div>
            <SelectField label="Location (district)" value={draft.district} onChange={(v) => setD("district", v)} options={DISTRICTS} />
            <SelectField label="Religion" value={draft.religion} onChange={(v) => setD("religion", v)} options={RELIGIONS} />
            <SelectField label="Community" value={draft.ethnicity} onChange={(v) => setD("ethnicity", v)} options={ETHNICITIES} />
            <SelectField label="Education" value={draft.education} onChange={(v) => setD("education", v)} options={EDUCATION} />
            <TextField label="Profession" value={draft.occupation} placeholder="e.g. Engineer" onChange={(v) => setD("occupation", v)} />
            <TextField label="Minimum height (cm)" type="number" value={draft.heightMin} onChange={(v) => setD("heightMin", v)} />
            <SelectField label="Marital status" value={draft.marital} onChange={(v) => setD("marital", v)} options={MARITAL} />
            <SelectField label="Language" value={draft.language} onChange={(v) => setD("language", v)} options={LANGUAGES} />
            <SelectField label="Lifestyle (diet)" value={draft.diet} onChange={(v) => setD("diet", v)} options={DIETS} />
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">Interests</p>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((t) => {
                  const on = draft.interests.includes(t);
                  return <button type="button" key={t} onClick={() => setD("interests", on ? draft.interests.filter((x) => x !== t) : [...draft.interests, t])}
                    className={`rounded-full border px-3 py-1 text-sm ${on ? "border-brand-600 bg-brand-600 text-white" : "border-stone-300"}`}>{t}</button>;
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={draft.verifiedOnly} onChange={(e) => setD("verifiedOnly", e.target.checked)} />Face-verified only</label>
            <div className="flex gap-2 pt-1">
              <button className={btnSmallOutline} onClick={() => setDraft(defaultFilters(profile))}>Reset</button>
              <button className={`${btnPrimary} !py-2.5`} onClick={() => { setFilters(draft); setMode("explore"); setSheet(false); }}>Apply filters</button>
            </div>
          </div>
        </div>
      )}
      {match && <MatchModal name={match.full_name} photo={match.photoUrl} chatTo={match.id} onClose={() => setMatch(null)} />}
    </div>
  );
}
