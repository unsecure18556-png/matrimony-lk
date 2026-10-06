import { supabase } from "./supabase";
import { attachPhotos } from "./cardService";
import { ageFromDob, type Profile } from "./profileService";
import { shortlistIds } from "./socialService";
import { EDUCATION } from "../utils/constants";

export interface Scored { score: number; reasons: string[] }

const mode = (vals: (string | null)[]) => {
  const c = new Map<string, number>();
  vals.forEach((v) => v && c.set(v, (c.get(v) ?? 0) + 1));
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

/** Weighted compatibility score (0-100) with human-readable reasons. */
export function scoreMatch(me: Profile, c: Profile, liked: Profile[] = []): Scored {
  let s = 0;
  const r: string[] = [];
  const myAge = me.dob ? ageFromDob(me.dob) : null;
  const cAge = c.dob ? ageFromDob(c.dob) : null;

  if (cAge != null) {
    const lo = me.pref_age_min ?? 18, hi = me.pref_age_max ?? 80;
    if (cAge >= lo && cAge <= hi) { s += 12; r.push(`Age ${cAge} is inside your preferred range`); }
    else if (cAge >= lo - 3 && cAge <= hi + 3) s += 6;
  }
  if (myAge != null) {
    const lo = c.pref_age_min ?? 18, hi = c.pref_age_max ?? 80;
    if (myAge >= lo && myAge <= hi) { s += 8; r.push("You fit their preferred age range"); }
    else if (myAge >= lo - 3 && myAge <= hi + 3) s += 4;
  }
  const pr = me.pref_religion ?? "any";
  if (c.religion) {
    if (c.religion === me.religion) { s += 20; r.push(`Same religion (${c.religion})`); }
    else if (pr === "any") s += 12;
    else if (pr === c.religion) { s += 20; r.push(`Matches your preferred religion`); }
  }
  const pe = me.pref_ethnicity ?? "any";
  if (c.ethnicity) {
    if (c.ethnicity === me.ethnicity) { s += 10; r.push(`Same ethnicity (${c.ethnicity})`); }
    else if (pe === "any") s += 6;
    else if (pe === c.ethnicity) { s += 10; r.push("Matches your preferred ethnicity"); }
  }
  if (c.mother_tongue && c.mother_tongue === me.mother_tongue) { s += 6; r.push(`Both speak ${c.mother_tongue}`); }
  const pd = me.pref_district ?? "any";
  if (c.district) {
    if (pd !== "any" && pd === c.district) { s += 8; r.push(`Lives in your preferred district (${c.district})`); }
    else if (c.district === me.district) { s += 8; r.push(`Same district (${c.district})`); }
  }
  const pm = me.pref_marital ?? "any";
  if (c.marital_status) {
    if (pm === "any" || pm === c.marital_status) { s += 6; if (pm !== "any") r.push(`${c.marital_status}, as you prefer`); }
  }
  const ei = EDUCATION.indexOf(me.education ?? ""), ci = EDUCATION.indexOf(c.education ?? "");
  if (ei >= 0 && ci >= 0) {
    const d = Math.abs(ei - ci);
    s += d <= 1 ? 10 : d === 2 ? 6 : 2;
    if (d <= 1) r.push("Similar education level");
  }
  if (c.diet && c.diet === me.diet) { s += 5; r.push(`Same diet (${c.diet})`); }
  if (c.family_type && c.family_type === me.family_type) s += 3;
  s += Math.round((c.completion_score / 100) * 7);
  if (c.face_verified) { s += 5; r.push("Face-verified profile"); }

  // learns from your shortlist
  if (liked.length >= 2) {
    let boost = 0;
    if (c.district && c.district === mode(liked.map((p) => p.district))) boost += 3;
    if (c.ethnicity && c.ethnicity === mode(liked.map((p) => p.ethnicity))) boost += 3;
    if (c.education && c.education === mode(liked.map((p) => p.education))) boost += 2;
    if (boost) { s += boost; r.push("Similar to profiles you shortlisted"); }
  }
  return { score: Math.min(100, Math.round(s)), reasons: r };
}

export const matchLabel = (n: number) => (n >= 80 ? "Excellent match" : n >= 65 ? "Good match" : "Possible match");

export async function findBestMatches(me: Profile, limit = 30) {
  const { data } = await supabase.from("profiles").select("*")
    .eq("onboarding_complete", true).neq("id", me.id)
    .eq("gender", me.gender === "male" ? "female" : "male").limit(400);
  const cands = (data ?? []) as Profile[];
  const ids = await shortlistIds(me.id);
  let liked: Profile[] = [];
  if (ids.length) {
    const { data: l } = await supabase.from("profiles").select("*").in("id", ids);
    liked = (l ?? []) as Profile[];
  }
  const scored = cands
    .map((c) => ({ c, sc: scoreMatch(me, c, liked) }))
    .sort((a, b) => b.sc.score - a.sc.score).slice(0, limit);
  const cards = await attachPhotos(scored.map((x) => x.c));
  return cards.map((card, i) => ({ card, sc: scored[i].sc }));
}
