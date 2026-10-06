import { supabase } from "./supabase";
import { attachPhotos } from "./cardService";
import type { Profile } from "./profileService";

export interface Filters {
  ageMin: number; ageMax: number; religion: string; ethnicity: string; district: string;
  education: string; marital: string; language: string; diet: string;
  heightMin: string; verifiedOnly: boolean;
  q: string; occupation: string; interests: string[];
}

export const defaultFilters = (me?: Profile): Filters => ({
  ageMin: me?.pref_age_min ?? 21, ageMax: me?.pref_age_max ?? 35,
  religion: "", ethnicity: "", district: "", education: "", marital: "",
  language: "", diet: "", heightMin: "", verifiedOnly: false,
  q: "", occupation: "", interests: [],
});

export const PAGE_SIZE = 24;

export async function searchProfiles(me: Profile, f: Filters, page = 0) {
  const dobFor = (age: number) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - age);
    return d.toISOString().slice(0, 10);
  };
  let q = supabase.from("profiles").select("*")
    .eq("onboarding_complete", true).neq("id", me.id)
    .lte("dob", dobFor(f.ageMin)).gt("dob", dobFor(f.ageMax + 1));
  if (me.gender) q = q.eq("gender", me.gender === "male" ? "female" : "male");
  if (f.religion) q = q.eq("religion", f.religion);
  if (f.ethnicity) q = q.eq("ethnicity", f.ethnicity);
  if (f.district) q = q.eq("district", f.district);
  if (f.education) q = q.eq("education", f.education);
  if (f.marital) q = q.eq("marital_status", f.marital);
  if (f.language) q = q.eq("mother_tongue", f.language);
  if (f.diet) q = q.eq("diet", f.diet);
  if (f.heightMin) q = q.gte("height_cm", Number(f.heightMin));
  if (f.verifiedOnly) q = q.eq("face_verified", true);
  const clean = (v: string) => v.replace(/[,%()*\\]/g, " ").trim();
  if (clean(f.q)) { const t = clean(f.q); q = q.or(`full_name.ilike.%${t}%,occupation.ilike.%${t}%,district.ilike.%${t}%`); }
  if (clean(f.occupation)) q = q.ilike("occupation", `%${clean(f.occupation)}%`);
  if (f.interests.length) q = q.overlaps("interests", f.interests);
  const { data, error } = await q
    .order("face_verified", { ascending: false })
    .order("completion_score", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (error) throw error;
  return attachPhotos((data ?? []) as Profile[]);
}
