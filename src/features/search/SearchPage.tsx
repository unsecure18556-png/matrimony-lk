import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { defaultFilters, PAGE_SIZE, searchProfiles, type Filters } from "../../services/searchService";
import { setShortlisted, shortlistIds } from "../../services/socialService";
import type { ProfileCard } from "../../services/cardService";
import ProfileCardView from "../../components/ProfileCardView";
import { SelectField, TextField } from "../../components/ui/Fields";
import { btnSmall, btnSmallOutline, panel } from "../../components/ui/styles";
import Icon from "../../components/ui/Icon";
import { CardSkeletons, EmptyState, PageLoader } from "../../components/ui/Feedback";
import { DIETS, DISTRICTS, EDUCATION, ETHNICITIES, LANGUAGES, MARITAL, RELIGIONS } from "../../utils/constants";

export default function SearchPage() {
  const { profile } = useAuth();
  const [f, setF] = useState<Filters>(defaultFilters(profile ?? undefined));
  const [results, setResults] = useState<ProfileCard[]>([]);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((x) => ({ ...x, [k]: v }));

  async function run(p = 0) {
    if (!profile) return;
    setBusy(true); setError("");
    try {
      const r = await searchProfiles(profile, f, p);
      setResults((old) => (p === 0 ? r : [...old, ...r]));
      setPage(p); setSearched(true); setShowFilters(false);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!profile) return;
    shortlistIds(profile.id).then((ids) => setSaved(new Set(ids)));
    run(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function toggle(id: string) {
    if (!profile) return;
    const on = !saved.has(id);
    await setShortlisted(profile.id, id, on);
    setSaved((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  }

  return (
    <div className="grid gap-3 md:grid-cols-[280px_1fr] md:gap-5">
      <button onClick={() => setShowFilters(!showFilters)}
        className="rounded-xl bg-white px-4 py-3 text-left font-semibold shadow-sm ring-1 ring-black/5 md:hidden">
        <span className="flex items-center justify-between"><span className="flex items-center gap-2"><Icon name="sliders" size={18} />Filters</span><Icon name={showFilters ? "chevronUp" : "chevronDown"} size={18} /></span>
      </button>
      <aside className={`${panel} h-fit space-y-3 ${showFilters ? "" : "hidden"} md:block`}>
        <h2 className="font-display text-lg font-semibold">Search filters</h2>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Age from" type="number" min={18} max={80} value={f.ageMin} onChange={(v) => set("ageMin", Number(v) || 18)} />
          <TextField label="Age to" type="number" min={18} max={80} value={f.ageMax} onChange={(v) => set("ageMax", Number(v) || 80)} />
        </div>
        <SelectField label="Religion" value={f.religion} onChange={(v) => set("religion", v)} options={RELIGIONS} />
        <SelectField label="Ethnicity" value={f.ethnicity} onChange={(v) => set("ethnicity", v)} options={ETHNICITIES} />
        <SelectField label="District" value={f.district} onChange={(v) => set("district", v)} options={DISTRICTS} />
        <SelectField label="Mother tongue" value={f.language} onChange={(v) => set("language", v)} options={LANGUAGES} />
        <SelectField label="Marital status" value={f.marital} onChange={(v) => set("marital", v)} options={MARITAL} />
        <SelectField label="Education" value={f.education} onChange={(v) => set("education", v)} options={EDUCATION} />
        <SelectField label="Diet" value={f.diet} onChange={(v) => set("diet", v)} options={DIETS} />
        <TextField label="Minimum height (cm)" type="number" value={f.heightMin} onChange={(v) => set("heightMin", v)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.verifiedOnly} onChange={(e) => set("verifiedOnly", e.target.checked)} />
          Face-verified only
        </label>
        <div className="flex gap-2">
          <button className={btnSmall} disabled={busy} onClick={() => run(0)}>Search</button>
          <button className={btnSmallOutline} onClick={() => setF(defaultFilters(profile ?? undefined))}>Reset</button>
        </div>
      </aside>

      <section>
        {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
        {searched && results.length === 0 && !busy && (
          <EmptyState icon="search" title="No profiles found" text="Try widening your filters, such as the age range or district." />
        )}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
          {results.map((c) => (
            <ProfileCardView key={c.id} card={c} shortlisted={saved.has(c.id)} onToggleShortlist={() => toggle(c.id)} />
          ))}
        </div>
        {busy && <CardSkeletons n={results.length ? 3 : 6} />}
        {results.length > 0 && results.length === (page + 1) * PAGE_SIZE && !busy && (
          <div className="py-4 text-center">
            <button className={btnSmallOutline} onClick={() => run(page + 1)}>Load more</button>
          </div>
        )}
      </section>
    </div>
  );
}
