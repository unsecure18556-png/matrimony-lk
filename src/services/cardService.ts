import { supabase } from "./supabase";
import type { Profile } from "./profileService";

export interface ProfileCard extends Profile {
  photoUrl: string | null; // null = no access or no photo
  hasPhoto: boolean;       // true + photoUrl null => photo is locked
}

export async function attachPhotos(profiles: Profile[]): Promise<ProfileCard[]> {
  if (!profiles.length) return [];
  const ids = profiles.map((p) => p.id);
  const { data: rows } = await supabase
    .from("profile_photos").select("user_id,path,is_primary").in("user_id", ids);
  const byUser = new Map<string, string>();
  for (const r of rows ?? []) {
    if (r.is_primary || !byUser.has(r.user_id)) byUser.set(r.user_id, r.path);
  }
  const urls = new Map<string, string>();
  const paths = [...byUser.values()];
  if (paths.length) {
    const { data } = await supabase.storage.from("profile-photos").createSignedUrls(paths, 3600);
    for (const d of data ?? []) if (d.signedUrl && !d.error && d.path) urls.set(d.path, d.signedUrl);
  }
  return profiles.map((p) => {
    const path = byUser.get(p.id);
    return { ...p, hasPhoto: !!path, photoUrl: path ? urls.get(path) ?? null : null };
  });
}

export async function getCards(ids: string[]): Promise<ProfileCard[]> {
  if (!ids.length) return [];
  const { data } = await supabase.from("profiles").select("*").in("id", ids);
  const cards = await attachPhotos((data ?? []) as Profile[]);
  const order = new Map(ids.map((id, i) => [id, i]));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
