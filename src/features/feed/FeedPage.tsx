import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchFeed, loadFeedback, type FeedbackSummary, type Post } from "../../services/postService";
import { myInterests } from "../../services/interestService";
import { findBestMatches } from "../../services/matchService";
import type { ProfileCard } from "../../services/cardService";
import { isMatchPost, rankPosts, shuffle, type RankCtx } from "../../utils/feedRank";
import PostCard from "../../components/PostCard";
import StoryTray from "../../components/stories/StoryTray";
import StoryViewer from "../../components/stories/StoryViewer";
import { cleanupMyExpired, fetchTray, type StoryGroup } from "../../services/storyService";
import Icon from "../../components/ui/Icon";
import { EmptyState } from "../../components/ui/Feedback";
import { btnSmall, panel } from "../../components/ui/styles";
import { DISTRICTS } from "../../utils/constants";

type Tab = "foryou" | "recent" | "matches";
const SEEN_KEY = "seen_posts_v1";
const loadSeen = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]")); } catch { return new Set(); } };
const saveSeen = (s: Set<string>) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-500))); } catch { /* ignore */ } };
interface Item { key: string; post: Post }

export default function FeedPage() {
  const { user, profile } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") as Tab) || "foryou";
  const tag = sp.get("tag") ?? "";
  const loc = sp.get("loc") ?? "";
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [err, setErr] = useState("");
  const [people, setPeople] = useState<ProfileCard[]>([]);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [openStory, setOpenStory] = useState<number | null>(null);
  const reloadTray = useCallback(() => { if (user) fetchTray(user.id).then(setGroups).catch(() => {}); }, [user]);
  useEffect(() => { if (user) cleanupMyExpired(user.id).finally(reloadTray); }, [user, reloadTray]);

  const cursor = useRef<string | undefined>(undefined);
  const exhausted = useRef(false);
  const busy = useRef(false);
  const stopped = useRef(false);
  const counter = useRef(0);
  const ctx = useRef<RankCtx | null>(null);
  const lastId = useRef<string | undefined>(undefined);
  const sentinel = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(loadSeen());

  const prepare = useCallback((posts: Post[]) => {
    const c = ctx.current;
    if (!c) return posts;
    let list = posts.filter((p) => !c.feedback.hidden.has(p.id));
    if (tab === "matches") list = list.filter((p) => isMatchPost(p, c));
    if (tab === "foryou") list = rankPosts(list, c);
    return list;
  }, [tab]);

  const loadMore = useCallback(async () => {
    if (busy.current || stopped.current || !user || !ctx.current) return;
    busy.current = true; setLoading(true); setErr("");
    try {
      let batch: Post[] = [];
      let guard = 0;
      while (batch.length < 4 && !exhausted.current && guard++ < 3) {
        const r = await fetchFeed(user.id, { tag: tag || undefined, district: loc || undefined, before: cursor.current, limit: 15 });
        cursor.current = r.cursor;
        if (!r.hasMore) exhausted.current = true;
        batch = batch.concat(prepare(r.posts));
      }
      if (batch.length === 0 && exhausted.current) {
        // Fresh posts are finished: start again from the top, mixing in posts seen before.
        const r = await fetchFeed(user.id, { tag: tag || undefined, district: loc || undefined, limit: 15 });
        batch = shuffle(prepare(r.posts));
        cursor.current = r.cursor;
        exhausted.current = !r.hasMore;
        if (batch.length === 0) { stopped.current = true; }
      }
      if (batch.length && batch[0].id === lastId.current && batch.length > 1) batch.push(batch.shift()!); // never the same post twice in a row
      if (batch.length) {
        lastId.current = batch[batch.length - 1].id;
        setItems((old) => [...old, ...batch.map((post) => ({ key: `${post.id}-${counter.current++}`, post }))]);
      }
    } catch (e: any) { setErr(e.message); stopped.current = true; }
    finally { busy.current = false; setLoading(false); }
  }, [user, tag, loc, prepare]);

  // (re)start whenever tab / filters change
  useEffect(() => {
    if (!user || !profile) return;
    let alive = true;
    (async () => {
      const [feedback, ints] = await Promise.all([loadFeedback(user.id), myInterests(user.id)]);
      if (!alive) return;
      const connected = new Set(ints.filter((i) => i.status === "accepted").map((i) => (i.from_uid === user.id ? i.to_uid : i.from_uid)));
      ctx.current = { me: profile, seen: seen.current, feedback: feedback as FeedbackSummary, connected };
      cursor.current = undefined; exhausted.current = false; stopped.current = false; lastId.current = undefined;
      setItems([]); setEmpty(false);
      await loadMore();
      if (alive) setEmpty(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.id, tab, tag, loc]);

  useEffect(() => { if (profile) findBestMatches(profile, 10).then((r) => setPeople(r.map((x) => x.card))); }, [profile]);

  // infinite scroll
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !sentinel.current) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) loadMore(); }, { rootMargin: "900px" });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [loadMore, items.length]);

  // remember which posts were actually viewed
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      let changed = false;
      for (const en of entries) if (en.isIntersecting) { const id = (en.target as HTMLElement).dataset.postId!; if (!seen.current.has(id)) { seen.current.add(id); changed = true; } }
      if (changed) saveSeen(seen.current);
    }, { threshold: 0.6 });
    document.querySelectorAll("[data-post-id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length]);

  const trending = useMemo(() => {
    const c = new Map<string, number>();
    items.forEach(({ post }) => post.hashtags.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [items]);

  const setParam = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); };
  if (!profile || !user) return null;

  const tabBtn = (t: Tab, label: string) => (
    <button key={t} onClick={() => setParam("tab", t === "foryou" ? "" : t)}
      className={`flex-1 border-b-2 py-2.5 text-sm font-semibold transition ${tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-stone-500"}`}>{label}</button>
  );
  const chip = (active: boolean) => `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${active ? "bg-brand-600 text-white" : "bg-white text-stone-600 ring-1 ring-stone-900/10 hover:bg-stone-50"}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,640px)_300px] lg:justify-center">
      <div className="space-y-4">
        <StoryTray groups={groups} meId={user.id} myName={profile.full_name} people={people} onOpen={setOpenStory} />

        <div className="flex border-b border-stone-200">{tabBtn("foryou", "For You")}{tabBtn("recent", "Recent")}{tabBtn("matches", "Matches")}</div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {profile.district && <button className={chip(loc === profile.district)} onClick={() => setParam("loc", loc === profile.district ? "" : profile.district!)}>Near me</button>}
          {tag && <button className={chip(true)} onClick={() => setParam("tag", "")}>#{tag} ✕</button>}
          {trending.filter((t) => t !== tag).slice(0, 5).map((t) => <button key={t} className={chip(false)} onClick={() => setParam("tag", t)}>#{t}</button>)}
          <select aria-label="Filter by district" value={loc} onChange={(e) => setParam("loc", e.target.value)}
            className="shrink-0 rounded-full border-0 bg-white py-1.5 pl-3 pr-8 text-sm text-stone-600 ring-1 ring-stone-900/10">
            <option value="">Anywhere</option>
            {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}

        {items.map(({ key, post }) => (
          <div key={key} data-post-id={post.id}>
            <PostCard post={post} me={user.id} onDeleted={(id) => setItems((old) => old.filter((x) => x.post.id !== id))} />
          </div>
        ))}

        {loading && (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5">
                <div className="flex items-center gap-3 p-3"><div className="h-10 w-10 animate-pulse rounded-full bg-stone-200" /><div className="h-3 w-32 animate-pulse rounded bg-stone-200" /></div>
                <div className="aspect-[4/5] animate-pulse bg-brand-100/60" />
              </div>
            ))}
          </div>
        )}

        {!loading && empty && items.length === 0 && !err && (
          <EmptyState icon="image" title={tab === "matches" ? "No posts from your matches yet" : tag || loc ? "No posts found" : "No posts yet"}
            text={tab === "matches" ? "Posts from your matches and mutual interests appear here." : tag || loc ? "Try another hashtag or location." : "Be the first to share something with the community."}
            action={<Link to="/create" className={btnSmall}><Icon name="plus" size={16} />Create a post</Link>} />
        )}

        <div ref={sentinel} className="h-8" />
      </div>

      {openStory !== null && groups[openStory] && <StoryViewer groups={groups} startIndex={openStory} meId={user.id} onClose={() => { setOpenStory(null); reloadTray(); }} />}

      <aside className="hidden space-y-4 lg:block">
        <Link to="/create" className={`${btnSmall} w-full !py-3`}><Icon name="plus" size={18} />Create a post</Link>
        {profile.completion_score < 100 && (
          <div className={panel}>
            <p className="text-sm font-semibold">Profile {profile.completion_score}% complete</p>
            <div className="mt-2 h-2 rounded bg-stone-100"><div className="h-2 rounded bg-brand-600" style={{ width: `${profile.completion_score}%` }} /></div>
            <Link to="/onboarding" className="mt-3 inline-block text-sm font-medium text-brand-700">Complete your profile</Link>
          </div>
        )}
        {trending.length > 0 && (
          <div className={panel}>
            <h2 className="mb-2 flex items-center gap-1.5 font-display text-lg font-semibold"><Icon name="hash" size={18} />Trending</h2>
            <div className="flex flex-wrap gap-2">{trending.map((t) => <button key={t} onClick={() => setParam("tag", t)} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">#{t}</button>)}</div>
          </div>
        )}
      </aside>
    </div>
  );
}
