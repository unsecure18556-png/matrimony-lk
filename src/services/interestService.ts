import { supabase } from "./supabase";

export interface Interest {
  id: string; from_uid: string; to_uid: string; message: string | null;
  status: "pending" | "accepted" | "declined"; created_at: string;
}
export type Relation = "none" | "sent" | "received" | "connected" | "declined";

export async function myInterests(uid: string): Promise<Interest[]> {
  const { data } = await supabase.from("interests").select("*")
    .or(`from_uid.eq.${uid},to_uid.eq.${uid}`).order("created_at", { ascending: false });
  return (data ?? []) as Interest[];
}

export async function sendInterest(from: string, to: string, message: string) {
  const { error } = await supabase.from("interests")
    .insert({ from_uid: from, to_uid: to, message: message || null });
  if (error) throw error;
}
export async function respondInterest(id: string, accept: boolean) {
  const { error } = await supabase.rpc("respond_interest", { p_id: id, p_accept: accept });
  if (error) throw error;
}
export async function withdrawInterest(id: string) {
  const { error } = await supabase.from("interests").delete().eq("id", id);
  if (error) throw error;
}

export function relationWith(list: Interest[], me: string, other: string): { state: Relation; interest?: Interest } {
  const i = list.find((x) =>
    (x.from_uid === me && x.to_uid === other) || (x.from_uid === other && x.to_uid === me));
  if (!i) return { state: "none" };
  if (i.status === "accepted") return { state: "connected", interest: i };
  if (i.from_uid === me) return { state: i.status === "declined" ? "declined" : "sent", interest: i };
  return i.status === "pending" ? { state: "received", interest: i } : { state: "none", interest: i };
}
