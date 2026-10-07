import { supabase } from "./supabase";

const BUCKET = "profile-photos";

export interface Profile {
  id: string;
  full_name: string;
  creating_for: string;
  onboarding_complete: boolean;
  photo_visibility: string;
  completion_score: number;
  gender: string | null;
  dob: string | null;
  height_cm: number | null;
  marital_status: string | null;
  district: string | null;
  country_living: string | null;
  religion: string | null;
  ethnicity: string | null;
  caste: string | null;
  mother_tongue: string | null;
  diet: string | null;
  education: string | null;
  occupation: string | null;
  family_type: string | null;
  father_occupation: string | null;
  mother_occupation: string | null;
  siblings: number | null;
  about: string | null;
  pref_age_min: number | null;
  pref_age_max: number | null;
  pref_religion: string | null;
  pref_ethnicity: string | null;
  pref_district: string | null;
  pref_marital: string | null;
  nakath: string | null;
  rashi: string | null;
  face_verified: boolean;
  face_match_opt_in: boolean;
  interests: string[] | null;
}

export interface Photo {
  id: string;
  path: string;
  is_primary: boolean;
  url: string;
}

export async function getProfile(uid: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).single();
  if (error) throw error;
  return data as Profile;
}

export async function saveProfile(uid: string, patch: Partial<Profile>) {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "id") continue;
    clean[k] = v === "" ? null : v;
  }
  clean.updated_at = new Date().toISOString();
  const { error } = await supabase.from("profiles").update(clean).eq("id", uid);
  if (error) throw error;
}

export function ageFromDob(dob: string) {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

const SCORED: (keyof Profile)[] = [
  "gender","dob","height_cm","marital_status","district","religion","ethnicity",
  "mother_tongue","diet","education","occupation","family_type","father_occupation",
  "mother_occupation","siblings","about",
];

export function calcCompletion(p: Partial<Profile>, photoCount: number) {
  const filled = SCORED.filter((k) => p[k] !== null && p[k] !== undefined && p[k] !== "").length;
  const total = SCORED.length + 1;
  return Math.round(((filled + (photoCount > 0 ? 1 : 0)) / total) * 100);
}

export async function resizeImage(file: File, max = 1080): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not process image"))), "image/jpeg", 0.85)
  );
}

export async function listPhotos(uid: string): Promise<Photo[]> {
  const { data } = await supabase
    .from("profile_photos").select("*").eq("user_id", uid).order("created_at");
  if (!data?.length) return [];
  const { data: urls } = await supabase.storage
    .from(BUCKET).createSignedUrls(data.map((p) => p.path), 3600);
  return data.map((p) => ({
    id: p.id,
    path: p.path,
    is_primary: p.is_primary,
    url: urls?.find((u) => u.path === p.path)?.signedUrl ?? "",
  }));
}

export async function uploadPhoto(uid: string, file: File, makePrimary: boolean) {
  const blob = await resizeImage(file);
  const path = `${uid}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  const { error: e2 } = await supabase
    .from("profile_photos").insert({ user_id: uid, path, is_primary: makePrimary });
  if (e2) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw e2;
  }
}

export async function setPrimaryPhoto(uid: string, photoId: string) {
  await supabase.from("profile_photos").update({ is_primary: false }).eq("user_id", uid);
  const { error } = await supabase.from("profile_photos").update({ is_primary: true }).eq("id", photoId);
  if (error) throw error;
}

export async function deletePhoto(uid: string, photo: Photo) {
  await supabase.storage.from(BUCKET).remove([photo.path]);
  const { error } = await supabase.from("profile_photos").delete().eq("id", photo.id);
  if (error) throw error;
  if (photo.is_primary) {
    const { data } = await supabase
      .from("profile_photos").select("id").eq("user_id", uid).order("created_at").limit(1);
    if (data?.[0]) await setPrimaryPhoto(uid, data[0].id);
  }
}
