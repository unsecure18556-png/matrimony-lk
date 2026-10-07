import { supabase } from "./supabase";

export interface Notif {
  id: string; type: "interest" | "interest_accepted" | "interest_declined" | "match" | "like" | "comment" | "message";
  post_id: string | null; actor_id: string | null; created_at: string; read_at: string | null;
  actor: { id: string; full_name: string } | null;
}

export async function listNotifications(limit = 60): Promise<Notif[]> {
  const { data } = await supabase.from("notifications")
    .select("id,type,post_id,actor_id,created_at,read_at,actor:profiles(id,full_name)")
    .order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as Notif[];
}

export async function unreadNotificationCount(uid: string) {
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", uid).is("read_at", null);
  return count ?? 0;
}

export const markAllNotificationsRead = () => supabase.rpc("mark_notifications_read");
