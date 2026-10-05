import { supabase } from "./supabase";

export interface Message {
  id: string; from_uid: string; to_uid: string; body: string; created_at: string; read_at: string | null;
}

export async function getThread(me: string, other: string): Promise<Message[]> {
  const { data } = await supabase.from("messages").select("*")
    .or(`and(from_uid.eq.${me},to_uid.eq.${other}),and(from_uid.eq.${other},to_uid.eq.${me})`)
    .order("created_at", { ascending: true }).limit(300);
  return (data ?? []) as Message[];
}

export async function sendMessage(me: string, other: string, body: string) {
  const { data, error } = await supabase.from("messages")
    .insert({ from_uid: me, to_uid: other, body }).select().single();
  if (error) {
    throw new Error(error.message.includes("check")
      ? "Links are not allowed in messages for your safety."
      : error.message);
  }
  return data as Message;
}

export const markRead = (other: string) => supabase.rpc("mark_read", { p_other: other });

export async function conversationSummaries(me: string, partnerIds: string[]) {
  const { data } = await supabase.from("messages").select("*")
    .or(`from_uid.eq.${me},to_uid.eq.${me}`).order("created_at", { ascending: false }).limit(300);
  const last = new Map<string, Message>();
  const unread = new Map<string, number>();
  for (const m of (data ?? []) as Message[]) {
    const other = m.from_uid === me ? m.to_uid : m.from_uid;
    if (!partnerIds.includes(other)) continue;
    if (!last.has(other)) last.set(other, m);
    if (m.to_uid === me && !m.read_at) unread.set(other, (unread.get(other) ?? 0) + 1);
  }
  return { last, unread };
}

export function subscribeIncoming(me: string, onMessage: (m: Message) => void) {
  const ch = supabase.channel(`inbox-${me}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `to_uid=eq.${me}` },
      (payload) => onMessage(payload.new as Message))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

export async function unreadCount(me: string) {
  const { count } = await supabase.from("messages").select("id", { count: "exact", head: true })
    .eq("to_uid", me).is("read_at", null);
  return count ?? 0;
}
