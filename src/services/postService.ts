import { supabase } from "./supabase";
import { attachPhotos } from "./cardService";
import { resizeImage, type Profile } from "./profileService";
export type Visibility = "members" | "matches" | "private";

const BUCKET = "post-images";

export interface PostAuthor { id: string; full_name: string; district: string | null; face_verified: boolean; photoUrl: string | null }
export interface Post {
  id: string; user_id: string; caption: string | null; hashtags: string[];
  location: string | null; district: string | null; image_paths: string[]; created_at: string;
  visibility: Visibility; allow_comments: boolean; show_likes: boolean;
  author: PostAuthor; authorProfile: Profile; images: string[]; likes: number; comments: number; liked: boolean; saved: boolean;
}
export interface Comment { id: string; user_id: string; body: string; created_at: string; author: { full_name: string } | null }

const SELECT = "*, author:profiles(*), post_likes(count), post_comments(count)";

/** #tags in a caption (letters/digits incl. Sinhala & Tamil), lowercase, unique */
export function extractHashtags(text: string): string[] {
  const m = text.match(/#[\p{L}\p{N}\p{M}_]{2,30}/gu) ?? [];
  return [...new Set(m.map((t) => t.slice(1).toLowerCase()))].slice(0, 10);
}

async function hydrate(rows: any[], me: string): Promise<Post[]> {
  const visible = rows.filter((r) => r.author); // author hidden by RLS (blocked etc) => drop post
  if (!visible.length) return [];
  const paths = [...new Set(visible.flatMap((r) => r.image_paths as string[]))];
  const urls = new Map<string, string>();
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  for (const s of signed ?? []) if (s.signedUrl && !s.error && s.path) urls.set(s.path, s.signedUrl);
  const { data: likedRows } = await supabase.from("post_likes").select("post_id")
    .eq("user_id", me).in("post_id", visible.map((r) => r.id));
  const liked = new Set((likedRows ?? []).map((r) => r.post_id));
  const { data: savedRows } = await supabase.from("saved_posts").select("post_id")
    .eq("user_id", me).in("post_id", visible.map((r) => r.id));
  const saved = new Set((savedRows ?? []).map((r) => r.post_id));
  const withPhotos = await attachPhotos(visible.map((r) => r.author as Profile));
  const avatar = new Map(withPhotos.map((a) => [a.id, a.photoUrl]));
  return visible.map((r) => ({
    ...r,
    authorProfile: r.author as Profile,
    author: { id: r.author.id, full_name: r.author.full_name, district: r.author.district, face_verified: r.author.face_verified, photoUrl: avatar.get(r.author.id) ?? null },
    images: (r.image_paths as string[]).map((p) => urls.get(p)).filter(Boolean) as string[],
    likes: r.post_likes?.[0]?.count ?? 0,
    comments: r.post_comments?.[0]?.count ?? 0,
    liked: liked.has(r.id),
    saved: saved.has(r.id),
  }));
}

export interface FeedOpts { before?: string; tag?: string; district?: string; userId?: string; limit?: number }

export async function fetchFeed(me: string, o: FeedOpts = {}) {
  const limit = o.limit ?? 10;
  let q = supabase.from("posts").select(SELECT).order("created_at", { ascending: false }).limit(limit);
  if (o.before) q = q.lt("created_at", o.before);
  if (o.tag) q = q.contains("hashtags", [o.tag.toLowerCase()]);
  if (o.district) q = q.eq("district", o.district);
  if (o.userId) q = q.eq("user_id", o.userId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  return {
    posts: await hydrate(rows, me),
    hasMore: rows.length === limit,
    cursor: rows.length ? (rows[rows.length - 1].created_at as string) : undefined,
  };
}

export async function fetchPost(me: string, id: string): Promise<Post | null> {
  const { data } = await supabase.from("posts").select(SELECT).eq("id", id).maybeSingle();
  return data ? (await hydrate([data], me))[0] ?? null : null;
}

export interface PostOpts { visibility: Visibility; allowComments: boolean; showLikes: boolean }

export async function createPost(me: string, files: File[], caption: string, location: string, district: string, opts: PostOpts = { visibility: "members", allowComments: true, showLikes: true }) {
  const paths: string[] = [];
  try {
    for (const f of files) {
      const blob = await resizeImage(f, 1440);
      const path = `${me}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      paths.push(path);
    }
    const { error } = await supabase.from("posts").insert({
      user_id: me, caption: caption.trim() || null, hashtags: extractHashtags(caption),
      location: location.trim() || null, district: district || null, image_paths: paths,
      visibility: opts.visibility, allow_comments: opts.allowComments, show_likes: opts.showLikes,
    });
    if (error) throw error;
  } catch (e: any) {
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    const m = String(e.message ?? "");
    throw new Error(m.includes("posts_caption_check")
      ? "Captions cannot contain links or phone numbers."
      : m);
  }
}

export async function deletePost(post: Pick<Post, "id" | "image_paths">) {
  const { error } = await supabase.from("posts").delete().eq("id", post.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove(post.image_paths);
}

export async function setLiked(me: string, postId: string, on: boolean) {
  const { error } = on
    ? await supabase.from("post_likes").upsert({ post_id: postId, user_id: me })
    : await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", me);
  if (error) throw error;
}

export async function listComments(postId: string): Promise<Comment[]> {
  const { data } = await supabase.from("post_comments")
    .select("id,user_id,body,created_at,author:profiles(full_name)")
    .eq("post_id", postId).order("created_at", { ascending: true }).limit(100);
  return (data ?? []) as unknown as Comment[];
}

export async function addComment(me: string, postId: string, body: string) {
  const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: me, body: body.trim() });
  if (error) {
    throw new Error(error.message.includes("check") ? "Comments cannot contain links or phone numbers." : error.message);
  }
}

export async function deleteComment(id: string) {
  await supabase.from("post_comments").delete().eq("id", id);
}

export async function reportPost(me: string, post: Pick<Post, "id" | "user_id">, reason: string, details: string) {
  const { error } = await supabase.from("reports")
    .insert({ reporter: me, reported: post.user_id, post_id: post.id, reason, details: details || null });
  if (error) throw error;
}

export async function setSaved(me: string, postId: string, on: boolean) {
  const { error } = on
    ? await supabase.from("saved_posts").upsert({ user_id: me, post_id: postId })
    : await supabase.from("saved_posts").delete().eq("user_id", me).eq("post_id", postId);
  if (error) throw error;
}

export async function fetchSavedPosts(me: string): Promise<Post[]> {
  const { data } = await supabase.from("saved_posts").select("post_id,created_at").eq("user_id", me)
    .order("created_at", { ascending: false }).limit(60);
  const ids = (data ?? []).map((r) => r.post_id);
  if (!ids.length) return [];
  const { data: rows } = await supabase.from("posts").select(SELECT).in("id", ids);
  const posts = await hydrate(rows ?? [], me);
  const order = new Map(ids.map((id, i) => [id, i]));
  return posts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export type FeedbackKind = "hidden" | "not_interested";

export async function recordFeedback(me: string, post: Pick<Post, "id" | "user_id" | "hashtags">, kind: FeedbackKind) {
  const { error } = await supabase.from("post_feedback")
    .upsert({ user_id: me, post_id: post.id, author_id: post.user_id, kind, hashtags: post.hashtags });
  if (error) throw error;
}

export interface FeedbackSummary { hidden: Set<string>; authors: Set<string>; tags: Set<string> }

export async function loadFeedback(me: string): Promise<FeedbackSummary> {
  const { data } = await supabase.from("post_feedback").select("post_id,author_id,kind,hashtags")
    .eq("user_id", me).order("created_at", { ascending: false }).limit(500);
  const out: FeedbackSummary = { hidden: new Set(), authors: new Set(), tags: new Set() };
  for (const r of data ?? []) {
    out.hidden.add(r.post_id);
    if (r.kind === "not_interested") { out.authors.add(r.author_id); (r.hashtags ?? []).forEach((t: string) => out.tags.add(t)); }
  }
  return out;
}
