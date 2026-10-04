import { supabase } from "./supabase";

export async function shortlistIds(uid: string): Promise<string[]> {
  const { data } = await supabase.from("shortlist").select("profile_id").eq("user_id", uid)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => r.profile_id);
}

export async function setShortlisted(uid: string, pid: string, on: boolean) {
  const { error } = on
    ? await supabase.from("shortlist").upsert({ user_id: uid, profile_id: pid })
    : await supabase.from("shortlist").delete().eq("user_id", uid).eq("profile_id", pid);
  if (error) throw error;
}

export async function blockUser(uid: string, pid: string, name: string) {
  const { error } = await supabase.from("blocks").upsert({ blocker: uid, blocked: pid, blocked_name: name });
  if (error) throw error;
}
export async function unblockUser(uid: string, pid: string) {
  await supabase.from("blocks").delete().eq("blocker", uid).eq("blocked", pid);
}
export async function listBlocked(uid: string) {
  const { data } = await supabase.from("blocks").select("blocked,blocked_name").eq("blocker", uid);
  return data ?? [];
}

export async function reportUser(uid: string, pid: string, reason: string, details: string) {
  const { error } = await supabase.from("reports")
    .insert({ reporter: uid, reported: pid, reason, details: details || null });
  if (error) throw error;
}

export async function getContact(userId: string): Promise<string | null> {
  const { data } = await supabase.from("contacts").select("phone").eq("user_id", userId).maybeSingle();
  return data?.phone ?? null;
}
export async function saveContact(uid: string, phone: string) {
  const { error } = await supabase.from("contacts")
    .upsert({ user_id: uid, phone: phone || null, updated_at: new Date().toISOString() });
  if (error) throw error;
}
