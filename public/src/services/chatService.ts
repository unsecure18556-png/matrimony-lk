import { supabase } from "./supabase";
import { resizeImage } from "./profileService";

export type MessageKind = "text" | "image" | "video" | "voice" | "post";
export interface Message {
  id: string; from_uid: string; to_uid: string; body: string; created_at: string; read_at: string | null;
  kind: MessageKind; media_path: string | null; duration_s: number | null; post_id: string | null;
}
export const MAX_VIDEO_MB = 25;

export async function getThread(me: string, other: string): Promise<Message[]> {
  const { data } = await supabase.from("messages").select("*")
    .or(`and(from_uid.eq.${me},to_uid.eq.${other}),and(from_uid.eq.${other},to_uid.eq.${me})`)
    .order("created_at", { ascending: true }).limit(300);
  return (data ?? []) as Message[];
}

async function insertMessage(row: Partial<Message> & { from_uid: string; to_uid: string }) {
  const { data, error } = await supabase.from("messages").insert({ body: "", kind: "text", ...row }).select().single();
  if (error) {
    throw new Error(error.message.includes("verified websites") ? error.message
      : error.message.includes("row-level security") ? "You can only message people you are matched with."
      : error.message);
  }
  return data as Message;
}

export const sendMessage = (me: string, other: string, body: string) =>
  insertMessage({ from_uid: me, to_uid: other, body, kind: "text" });

async function uploadChatFile(me: string, blob: Blob, ext: string) {
  const path = `${me}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("chat-media").upload(path, blob, { contentType: blob.type });
  if (error) throw error;
  return path;
}

export async function sendImage(me: string, other: string, file: File) {
  const blob = await resizeImage(file, 1440);
  return insertMessage({ from_uid: me, to_uid: other, kind: "image", media_path: await uploadChatFile(me, blob, "jpg") });
}

export async function sendVideo(me: string, other: string, file: File) {
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(`Video is too large (max ${MAX_VIDEO_MB} MB).`);
  const ext = (file.type.split("/")[1] || "mp4").replace("quicktime", "mov");
  const blob = new Blob([file], { type: file.type || "video/mp4" });
  return insertMessage({ from_uid: me, to_uid: other, kind: "video", media_path: await uploadChatFile(me, blob, ext) });
}

export async function sendVoice(me: string, other: string, blob: Blob, seconds: number) {
  const base = (blob.type || "audio/webm").split(";")[0];
  const ext = base.includes("mp4") ? "m4a" : base.split("/")[1] || "webm";
  const clean = new Blob([blob], { type: base });
  return insertMessage({ from_uid: me, to_uid: other, kind: "voice", duration_s: Math.max(1, Math.round(seconds)),
    media_path: await uploadChatFile(me, clean, ext) });
}

export const sendPostShare = (me: string, other: string, postId: string) =>
  insertMessage({ from_uid: me, to_uid: other, kind: "post", post_id: postId });

const urlCache = new Map<string, { url: string; at: number }>();
export async function chatMediaUrl(path: string): Promise<string | null> {
  const hit = urlCache.get(path);
  if (hit && Date.now() - hit.at < 50 * 60_000) return hit.url;
  const { data } = await supabase.storage.from("chat-media").createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, at: Date.now() });
  return data.signedUrl;
}

/** Marks messages as seen (double tick for the sender) and tells the rest of the app to refresh badges. */
export async function markRead(other: string) {
  await supabase.rpc("mark_read", { p_other: other });
  window.dispatchEvent(new Event("chat-read"));
}

export const previewOf = (m: Message) =>
  m.kind === "voice" ? "Voice message" : m.kind === "image" ? "Photo" : m.kind === "video" ? "Video" : m.kind === "post" ? "Shared a post" : m.body;

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

/** New messages to me (for badges anywhere in the app) */
export function subscribeIncoming(me: string, onMessage: (m: Message) => void) {
  const ch = supabase.channel(`inbox-${me}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `to_uid=eq.${me}` },
      (payload) => onMessage(payload.new as Message))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/** Updates to messages I sent (someone read them => double tick) */
export function subscribeReceipts(me: string, onUpdate: (m: Message) => void) {
  const ch = supabase.channel(`receipts-${me}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `from_uid=eq.${me}` },
      (payload) => onUpdate(payload.new as Message))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

export async function unreadCount(me: string) {
  const { count } = await supabase.from("messages").select("id", { count: "exact", head: true })
    .eq("to_uid", me).is("read_at", null);
  return count ?? 0;
}

/** Returns the first link that is not on the verified list (the database enforces this too). */
export function findBadLink(text: string, domains: string[]): string | null {
  const re = /((?:https?:\/\/|www\.)[^\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const host = (m[1].replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/:?#\s]/)[0] ?? "").toLowerCase();
    if (!domains.some((d) => host === d || host.endsWith("." + d))) return host;
  }
  return null;
}
