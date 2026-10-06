import type { Post, FeedbackSummary } from "../services/postService";
import type { Profile } from "../services/profileService";
import { scoreMatch } from "../services/matchService";

export interface RankCtx {
  me: Profile;
  seen: Set<string>;
  feedback: FeedbackSummary;
  connected: Set<string>;
}

/** Higher = shown earlier. Fresh, compatible, nearby, unseen posts win; seen / "not interested" lose. */
export function scorePost(p: Post, c: RankCtx): number {
  const hours = (Date.now() - new Date(p.created_at).getTime()) / 36e5;
  let s = 40 * Math.exp(-hours / 48);                              // freshness
  s += scoreMatch(c.me, p.authorProfile).score * 0.4;              // compatibility 0-40
  if (c.connected.has(p.user_id)) s += 15;                         // mutual matches first
  if (p.district && p.district === c.me.district) s += 8;          // local
  const mine = (c.me.interests ?? []).map((x) => x.toLowerCase());
  s += Math.min(12, p.hashtags.filter((t) => mine.includes(t)).length * 6); // shared interests
  if (c.seen.has(p.id)) s -= 25;                                   // prefer unseen
  if (c.feedback.authors.has(p.user_id)) s -= 60;                  // "not interested" in this author
  s -= p.hashtags.filter((t) => c.feedback.tags.has(t)).length * 15;
  if (p.user_id === c.me.id) s -= 10;
  return s;
}

export const rankPosts = (posts: Post[], c: RankCtx) =>
  posts.map((p) => ({ p, s: scorePost(p, c) })).sort((a, b) => b.s - a.s).map((x) => x.p);

export const isMatchPost = (p: Post, c: RankCtx) =>
  c.connected.has(p.user_id) || scoreMatch(c.me, p.authorProfile).score >= 70;

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
