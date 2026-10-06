import { supabase } from "./supabase";
import { attachPhotos } from "./cardService";
import { resizeImage, type Profile } from "./profileService";

const BUCKET = "story-media";

export interface TextItem { id: string; text: string; color: string; x: number; y: number; size: number }
export interface StickerItem { id: string; emoji: string; x: number; y: number; size: number }
export interface Stroke { color: string; w: number; pts: [number, number][] }
export interface Overlay {
  filter: string; adjust: { b: number; c: number; s: number };
  zoom: number; ox: number; oy: number;
  texts: TextItem[]; stickers: StickerItem[]; strokes: Stroke[]; location?: string;
}

export const FILTERS: Record<string, { label: string; css: string }> = {
  normal: { label: "Normal", css: "" },
  warm: { label: "Warm", css: "sepia(.25) saturate(1.3) hue-rotate(-10deg)" },
  cool: { label: "Cool", css: "saturate(1.1) hue-rotate(15deg) brightness(1.05)" },
  vivid: { label: "Vivid", css: "saturate(1.6) contrast(1.1)" },
  fade: { label: "Fade", css: "contrast(.85) brightness(1.1) saturate(.8)" },
  mono: { label: "Mono", css: "grayscale(1)" },
  noir: { label: "Noir", css: "grayscale(1) contrast(1.3) brightness(.9)" },
};

export const emptyOverlay = (): Overlay => ({
  filter: "normal", adjust: { b: 100, c: 100, s: 100 }, zoom: 1, ox: 0, oy: 0, texts: [], stickers: [], strokes: [],
});

export const cssFilter = (o: Overlay) =>
  `${FILTERS[o.filter]?.css ?? ""} brightness(${o.adjust.b}%) contrast(${o.adjust.c}%) saturate(${o.adjust.s}%)`.trim();

export interface Story {
  id: string; user_id: string; media_path: string; media_type: "image" | "video"; overlay: Overlay;
  music_path: string | null; music_title: string | null; music_start: number; visibility: "members" | "matches";
  created_at: string; expires_at: string; mediaUrl: string; musicUrl: string | null;
}
export interface StoryGroup {
  userId: string; name: string; photoUrl: string | null; verified: boolean; stories: Story[]; hasUnseen: boolean; latest: string;
}

export async function fetchTray(me: string): Promise<StoryGroup[]> {
  const { data } = await supabase.from("stories").select("*, author:profiles(*)")
    .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true }).limit(300);
  const rows = (data ?? []).filter((r: any) => r.author);
  if (!rows.length) return [];
  const paths = [...new Set(rows.flatMap((r: any) => [r.media_path, r.music_path].filter(Boolean) as string[]))];
  const urls = new Map<string, string>();
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  for (const s of signed ?? []) if (s.signedUrl && !s.error && s.path) urls.set(s.path, s.signedUrl);
  const { data: viewed } = await supabase.from("story_views").select("story_id").eq("viewer_id", me).in("story_id", rows.map((r: any) => r.id));
  const seen = new Set((viewed ?? []).map((v) => v.story_id));
  const authors = await attachPhotos([...new Map(rows.map((r: any) => [r.author.id, r.author as Profile])).values()]);
  const photo = new Map(authors.map((a) => [a.id, a.photoUrl]));

  const groups = new Map<string, StoryGroup>();
  for (const r of rows as any[]) {
    const url = urls.get(r.media_path);
    if (!url) continue;
    const story: Story = { ...r, overlay: { ...emptyOverlay(), ...(r.overlay ?? {}) }, mediaUrl: url, musicUrl: r.music_path ? urls.get(r.music_path) ?? null : null };
    let g = groups.get(r.user_id);
    if (!g) { g = { userId: r.user_id, name: r.author.full_name, photoUrl: photo.get(r.user_id) ?? null, verified: r.author.face_verified, stories: [], hasUnseen: false, latest: r.created_at }; groups.set(r.user_id, g); }
    g.stories.push(story);
    g.latest = r.created_at;
    if (!seen.has(r.id) && r.user_id !== me) g.hasUnseen = true;
  }
  const list = [...groups.values()];
  const mine = list.find((g) => g.userId === me);
  const others = list.filter((g) => g.userId !== me).sort((a, b) => Number(b.hasUnseen) - Number(a.hasUnseen) || b.latest.localeCompare(a.latest));
  return mine ? [mine, ...others] : others;
}

export interface NewStory {
  file: File; mediaType: "image" | "video"; overlay: Overlay; visibility: "members" | "matches";
  music?: { file: File; title: string; start: number } | null;
}

export async function createStory(me: string, n: NewStory) {
  const uploaded: string[] = [];
  try {
    let blob: Blob = n.file; let ext = "mp4";
    if (n.mediaType === "image") { blob = await resizeImage(n.file, 1920); ext = "jpg"; }
    else ext = (n.file.type.split("/")[1] || "mp4").replace("quicktime", "mov");
    const media_path = `${me}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from(BUCKET).upload(media_path, blob, { contentType: blob.type || n.file.type });
    if (up.error) throw up.error;
    uploaded.push(media_path);
    let music_path: string | null = null;
    if (n.music) {
      const mext = (n.music.file.type.split("/")[1] || "mp3").replace("mpeg", "mp3").replace("x-m4a", "m4a");
      music_path = `${me}/${crypto.randomUUID()}-m.${mext}`;
      const mu = await supabase.storage.from(BUCKET).upload(music_path, n.music.file, { contentType: n.music.file.type });
      if (mu.error) throw mu.error;
      uploaded.push(music_path);
    }
    const { error } = await supabase.from("stories").insert({
      user_id: me, media_path, media_type: n.mediaType, overlay: n.overlay, visibility: n.visibility,
      music_path, music_title: n.music?.title.slice(0, 80) ?? null, music_start: n.music ? Math.round(n.music.start) : 0,
    });
    if (error) throw error;
  } catch (e) {
    if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
    throw e;
  }
}

export async function deleteStory(s: Pick<Story, "id" | "media_path" | "music_path">) {
  const { error } = await supabase.from("stories").delete().eq("id", s.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([s.media_path, ...(s.music_path ? [s.music_path] : [])]);
}

export async function markViewed(me: string, storyId: string) {
  await supabase.from("story_views").insert({ story_id: storyId, viewer_id: me }); // duplicates are ignored
}

export async function fetchViewers(storyId: string): Promise<{ id: string; name: string; at: string }[]> {
  const { data } = await supabase.from("story_views").select("viewed_at, viewer:profiles(id,full_name)")
    .eq("story_id", storyId).order("viewed_at", { ascending: false }).limit(200);
  return (data ?? []).filter((r: any) => r.viewer).map((r: any) => ({ id: r.viewer.id, name: r.viewer.full_name, at: r.viewed_at }));
}

/** Removes my own expired stories (rows + files) so storage does not fill up. */
export async function cleanupMyExpired(me: string) {
  const { data } = await supabase.from("stories").select("id,media_path,music_path").eq("user_id", me)
    .lt("expires_at", new Date().toISOString()).limit(50);
  for (const s of data ?? []) await deleteStory(s as Story).catch(() => {});
}
