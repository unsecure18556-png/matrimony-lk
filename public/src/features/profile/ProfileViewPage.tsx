import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getCards, type ProfileCard } from "../../services/cardService";
import { ageFromDob, listPhotos, type Photo } from "../../services/profileService";
import {
  myInterests, relationWith, respondInterest, sendInterest, withdrawInterest, type Interest,
} from "../../services/interestService";
import { blockUser, getContact, reportUser, setShortlisted, shortlistIds } from "../../services/socialService";
import { matchLabel, scoreMatch } from "../../services/matchService";
import { fetchFeed, type Post } from "../../services/postService";
import { fetchTray, type StoryGroup } from "../../services/storyService";
import { input } from "../../components/ui/styles";
import Icon, { type IconName } from "../../components/ui/Icon";
import ReportSheet from "../../components/ReportSheet";
import MatchModal from "../../components/MatchModal";
import StoryViewer from "../../components/stories/StoryViewer";
import { useVerifyGate } from "../../components/VerifyGate";
import { EmptyState, PageLoader } from "../../components/ui/Feedback";

type Tab = "posts" | "photos" | "about";
const btn = "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition active:scale-[.98]";
const primary = `${btn} flex-1 bg-brand-600 text-white hover:bg-brand-700`;
const secondary = `${btn} flex-1 bg-stone-200/80 text-ink hover:bg-stone-200`;
const iconBtn = `${btn} w-11 shrink-0 bg-stone-200/80 text-ink hover:bg-stone-200`;

export default function ProfileViewPage() {
  const { id } = useParams();
  const { user, profile: me } = useAuth();
  const nav = useNavigate();
  const { requireFace } = useVerifyGate();
  const [p, setP] = useState<ProfileCard | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [morePosts, setMorePosts] = useState(false);
  const [story, setStory] = useState<StoryGroup | null>(null);
  const [viewStory, setViewStory] = useState(false);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [saved, setSaved] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [tab, setTab] = useState<Tab>("posts");
  const [menu, setMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [more, setMore] = useState(false);
  const [view, setView] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const load = useCallback(async () => {
    if (!id || id === "me" || !user) return;
    const [cards, ph, ints, sl] = await Promise.all([
      getCards([id]), listPhotos(id), myInterests(user.id), shortlistIds(user.id),
    ]);
    if (!cards[0]) return setState("missing");
    setP(cards[0]); setPhotos(ph); setInterests(ints); setSaved(sl.includes(id));
    const rel = relationWith(ints, user.id, id);
    setPhone(rel.state === "connected" || id === user.id ? await getContact(id) : null);
    setState("ok");
    fetchFeed(user.id, { userId: id, limit: 30 }).then((r) => { setPosts(r.posts); setMorePosts(r.hasMore); }).catch(() => {});
    fetchTray(user.id).then((gs) => setStory(gs.find((g) => g.userId === id) ?? null)).catch(() => {});
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  if (!user) return null;
  if (id === "me") return <Navigate to={`/p/${user.id}`} replace />;
  if (state === "loading") return <PageLoader />;
  if (state === "missing" || !p)
    return <EmptyState icon="user" title="Profile not available" text="It may have been removed, or you may no longer be able to see it." />;

  const isMe = p.id === user.id;
  const rel = relationWith(interests, user.id, p.id);
  const match = me && !isMe ? scoreMatch(me, p) : null;
  const age = p.dob ? ageFromDob(p.dob) : null;
  const viewable = photos.filter((x) => x.url);
  const connections = interests.filter((i) => i.status === "accepted").length;
  const about = p.about ?? "";
  const longBio = about.length > 150;

  const run = async (fn: () => Promise<unknown>, ok = "") => {
    setErr(""); setMsg("");
    try { await fn(); if (ok) setMsg(ok); await load(); } catch (e: any) { setErr(e.message); }
  };
  const toggleSave = async () => { await setShortlisted(user.id, p.id, !saved); setSaved(!saved); };
  const share = async () => {
    const url = `${location.origin}/p/${p.id}`;
    try { if (navigator.share) await navigator.share({ title: p.full_name, url }); else { await navigator.clipboard.writeText(url); setMsg("Profile link copied"); } } catch { /* cancelled */ }
  };

  const stats: [string | number, string, Tab | null][] = [
    [`${posts.length}${morePosts ? "+" : ""}`, "Posts", "posts"],
    [photos.length, "Photos", "photos"],
    isMe ? [connections, "Matches", null] : [match ? `${match.score}%` : "-", "Match", "about"],
  ];

  const chips = [
    p.height_cm ? `${p.height_cm} cm` : null, p.religion, p.ethnicity, p.education, p.marital_status, p.mother_tongue,
  ].filter(Boolean) as string[];

  const groups: [string, [string, string | number | null][]][] = [
    ["Basics", [["Age", age], ["Height", p.height_cm ? `${p.height_cm} cm` : null], ["Marital status", p.marital_status], ["District", p.district], ["Living in", p.country_living]]],
    ["Background", [["Religion", p.religion], ["Ethnicity", p.ethnicity], ["Caste", p.caste], ["Mother tongue", p.mother_tongue], ["Diet", p.diet]]],
    ["Education and family", [["Education", p.education], ["Occupation", p.occupation], ["Family type", p.family_type], ["Father", p.father_occupation], ["Mother", p.mother_occupation], ["Siblings", p.siblings]]],
    ["Horoscope", [["Nakath", p.nakath], ["Rashi", p.rashi]]],
  ];
  const any = (v: string | null) => (!v || v === "any" ? "Any" : v);
  const looking: [string, string][] = [
    ["Age", `${p.pref_age_min ?? 18} to ${p.pref_age_max ?? 80}`], ["Religion", any(p.pref_religion)],
    ["Ethnicity", any(p.pref_ethnicity)], ["District", any(p.pref_district)], ["Marital status", any(p.pref_marital)],
  ];

  /* ---- action buttons (state based, like Follow / Message in Instagram) ---- */
  let actions: ReactNode;
  if (isMe) {
    actions = (<>
      <Link to="/onboarding" className={secondary}>Edit profile</Link>
      <Link to="/create" className={secondary}>New post</Link>
      <Link to="/story/new" aria-label="Add story" className={iconBtn}><Icon name="plus" size={18} /></Link>
    </>);
  } else {
    const main: ReactNode =
      rel.state === "none" ? <button className={primary} onClick={() => requireFace("send interests") && setShowNote(!showNote)}><Icon name="heart" size={16} />Send interest</button>
      : rel.state === "sent" ? <button className={secondary} onClick={() => confirm("Withdraw your interest?") && run(() => withdrawInterest(rel.interest!.id))}><Icon name="check" size={16} />Interest sent</button>
      : rel.state === "received" ? <button className={primary} onClick={() => requireFace("accept interests") && run(async () => { await respondInterest(rel.interest!.id, true); setCelebrate(true); })}>Accept</button>
      : rel.state === "connected" ? <Link to={`/messages/${p.id}`} className={primary}><Icon name="chat" size={16} />Message</Link>
      : <span className={`${secondary} opacity-60`}>Declined</span>;
    const second: ReactNode = rel.state === "received"
      ? <button className={secondary} onClick={() => requireFace("respond to interests") && run(() => respondInterest(rel.interest!.id, false))}>Decline</button>
      : <button className={secondary} onClick={toggleSave}><Icon name="star" size={16} filled={saved} />{saved ? "Shortlisted" : "Shortlist"}</button>;
    actions = (<>{main}{second}<button aria-label="Share profile" onClick={share} className={iconBtn}><Icon name="share" size={18} /></button></>);
  }

  const tabBtn = (t: Tab, icon: IconName, label: string) => (
    <button key={t} onClick={() => setTab(t)} aria-label={label}
      className={`flex flex-1 flex-col items-center gap-0.5 border-t-2 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition ${tab === t ? "border-ink text-ink" : "border-transparent text-stone-400"}`}>
      <Icon name={icon} size={22} />{label}
    </button>
  );

  const ringClass = story ? "bg-gradient-to-tr from-amber-400 via-brand-500 to-brand-700 p-[3px]" : "bg-brand-200 p-[2px]";
  const avatarInner = p.photoUrl
    ? <img src={p.photoUrl} alt="" className="h-[84px] w-[84px] rounded-full object-cover sm:h-36 sm:w-36" />
    : <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-brand-100 text-brand-600 sm:h-36 sm:w-36">
        {p.hasPhoto ? <Icon name="lock" size={28} /> : <span className="font-display text-4xl">{p.full_name[0]}</span>}
      </span>;

  return (
    <div className="mx-auto max-w-3xl">
      {/* top bar */}
      <div className="mb-2 grid grid-cols-[44px_1fr_44px] items-center">
        {isMe ? <span /> : <button onClick={() => nav(-1)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-stone-100"><Icon name="arrowLeft" size={22} /></button>}
        <h1 className="flex items-center justify-center gap-1.5 truncate text-center font-display text-xl font-semibold">
          <span className="truncate">{p.full_name}</span>
          {p.face_verified && <Icon name="shieldCheck" size={19} className="shrink-0 text-emerald-600" />}
        </h1>
        <div className="relative justify-self-end">
          {isMe ? (
            <Link to="/settings" aria-label="Settings" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-stone-100"><Icon name="menu" size={23} /></Link>
          ) : (
            <>
              <button onClick={() => setMenu(!menu)} aria-label="More" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-stone-100"><Icon name="dots" size={23} /></button>
              {menu && (
                <div className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-xl bg-white text-sm shadow-lg ring-1 ring-stone-900/10">
                  <button className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-stone-50" onClick={() => { setMenu(false); share(); }}><Icon name="share" size={17} />Share profile</button>
                  <button className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-stone-50" onClick={() => { setMenu(false); setShowReport(true); }}><Icon name="flag" size={17} />Report</button>
                  <button className="flex w-full items-center gap-2 px-4 py-3 text-left text-red-600 hover:bg-stone-50" onClick={async () => {
                    setMenu(false);
                    if (confirm(`Block ${p.full_name}? You will no longer see each other.`)) { await blockUser(user.id, p.id, p.full_name); nav("/discover"); }
                  }}><Icon name="ban" size={17} />Block</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* avatar + stats */}
      <div className="flex items-center gap-5 px-1 sm:gap-14 sm:px-6">
        <div className="relative shrink-0">
          {story ? (
            <button onClick={() => setViewStory(true)} aria-label="View story" className={`block rounded-full ${ringClass}`}><span className="block rounded-full bg-cream p-[3px]">{avatarInner}</span></button>
          ) : (
            <button onClick={() => viewable.length && setView(0)} aria-label="View photo" className={`block rounded-full ${ringClass}`}><span className="block rounded-full bg-cream p-[3px]">{avatarInner}</span></button>
          )}
          {isMe && <Link to="/story/new" aria-label="Add story" className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-cream"><Icon name="plus" size={16} strokeWidth={3} /></Link>}
        </div>
        <div className="grid flex-1 grid-cols-3 text-center">
          {stats.map(([n, l, t]) => (
            <button key={l} disabled={!t} onClick={() => t && setTab(t)} className="rounded-lg py-1 disabled:cursor-default">
              <span className="block text-lg font-bold leading-tight sm:text-xl">{n}</span>
              <span className="block text-[13px] text-stone-500">{l}</span>
            </button>
          ))}
        </div>
      </div>

      {/* name + bio */}
      <div className="mt-3 space-y-1 px-1 sm:px-6">
        <p className="text-[15px] font-semibold">{p.full_name}{age ? `, ${age}` : ""}</p>
        <p className="text-sm text-stone-500">{[p.occupation, p.district].filter(Boolean).join(" · ")}</p>
        {about && (
          <p className={`whitespace-pre-line text-sm leading-relaxed ${more ? "" : "line-clamp-3"}`}>{about}</p>
        )}
        {longBio && <button onClick={() => setMore(!more)} className="text-sm font-medium text-stone-500">{more ? "less" : "more"}</button>}
        {match && <p className="pt-0.5 text-sm font-semibold text-brand-600">{match.score}% match · {matchLabel(match.score)}</p>}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {chips.map((c) => <span key={c} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">{c}</span>)}
          </div>
        )}
      </div>

      {/* actions */}
      <div className="mt-4 space-y-2 px-1 sm:px-6">
        {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        {msg && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{msg}</p>}
        {phone && <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm"><Icon name="phone" size={16} />Contact number: <b>{phone}</b></p>}
        <div className="flex gap-2">{actions}</div>
        {showNote && rel.state === "none" && (
          <div className="flex gap-2">
            <input className={input} placeholder="Add a short message (optional)" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="rounded-xl bg-brand-600 px-4 font-semibold text-white" onClick={() => requireFace("send interests") && run(async () => { await sendInterest(user.id, p.id, note); setShowNote(false); setNote(""); }, "Interest sent")}>Send</button>
          </div>
        )}
      </div>

      {/* tabs */}
      <div className="mt-5 flex border-t border-stone-200">
        {tabBtn("posts", "grid", "Posts")}
        {tabBtn("photos", "image", "Photos")}
        {tabBtn("about", "user", "About")}
      </div>

      {tab === "posts" && (posts.length === 0 ? (
        <div className="py-10">
          <EmptyState icon="camera" title={isMe ? "Share your first post" : "No posts yet"}
            text={isMe ? "Photos you share appear here for other members to see." : `${p.full_name.split(" ")[0]} has not shared anything yet.`}
            action={isMe ? <Link to="/create" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Create a post</Link> : undefined} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
          {posts.map((x) => (
            <Link key={x.id} to={`/post/${x.id}`} className="group relative aspect-square overflow-hidden bg-stone-200">
              {x.images[0] && <img src={x.images[0]} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />}
              {x.images.length > 1 && <Icon name="grid" size={17} className="absolute right-1.5 top-1.5 text-white drop-shadow" />}
              <span className="absolute inset-0 flex items-center justify-center gap-3 bg-black/35 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100">
                <span className="flex items-center gap-1"><Icon name="heart" size={16} filled />{x.likes}</span>
                <span className="flex items-center gap-1"><Icon name="chat" size={16} filled />{x.comments}</span>
              </span>
            </Link>
          ))}
        </div>
      ))}

      {tab === "photos" && (photos.length === 0 ? (
        <div className="py-10"><EmptyState icon="image" title="No photos yet" /></div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
          {photos.map((x) => x.url ? (
            <button key={x.id} onClick={() => setView(viewable.indexOf(x))} className="aspect-square overflow-hidden bg-stone-200">
              <img src={x.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ) : (
            <div key={x.id} className="flex aspect-square flex-col items-center justify-center gap-1 bg-brand-100 text-brand-400">
              <Icon name="lock" size={22} /><span className="px-2 text-center text-[10px]">Private until accepted</span>
            </div>
          ))}
        </div>
      ))}

      {tab === "about" && (
        <div className="space-y-4 px-1 py-4 sm:px-6">
          {match && match.reasons.length > 0 && (
            <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-900/5">
              <h2 className="mb-2 font-display text-lg font-semibold">Why you match</h2>
              <ul className="space-y-1.5 text-sm">
                {match.reasons.map((r) => <li key={r} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-emerald-600" />{r}</li>)}
              </ul>
            </section>
          )}
          {(p.interests?.length ?? 0) > 0 && (
            <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-900/5">
              <h2 className="mb-2 font-display text-lg font-semibold">Interests</h2>
              <div className="flex flex-wrap gap-2">
                {p.interests!.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-lg border border-brand-300 bg-brand-50/60 px-3 py-1.5 text-sm text-brand-700"><Icon name="check" size={14} strokeWidth={2.6} />{t}</span>
                ))}
              </div>
            </section>
          )}
          {groups.map(([title, rows]) => {
            const shown = rows.filter(([, v]) => v !== null && v !== "");
            return shown.length ? (
              <section key={title} className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5">
                <h2 className="px-4 pt-3 font-display text-lg font-semibold">{title}</h2>
                {shown.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-stone-100 px-4 py-2.5 text-sm last:border-0"><span className="text-stone-500">{k}</span><span className="text-right font-medium">{v}</span></div>
                ))}
              </section>
            ) : null;
          })}
          <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5">
            <h2 className="px-4 pt-3 font-display text-lg font-semibold">Looking for</h2>
            {looking.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-stone-100 px-4 py-2.5 text-sm last:border-0"><span className="text-stone-500">{k}</span><span className="font-medium">{v}</span></div>
            ))}
          </section>
        </div>
      )}

      {/* photo viewer */}
      {view !== null && viewable[view] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" onClick={() => setView(null)}>
          <button aria-label="Close" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"><Icon name="x" size={22} /></button>
          {view > 0 && <button aria-label="Previous" onClick={(e) => { e.stopPropagation(); setView(view - 1); }} className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"><Icon name="arrowLeft" size={22} /></button>}
          {view < viewable.length - 1 && <button aria-label="Next" onClick={(e) => { e.stopPropagation(); setView(view + 1); }} className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"><Icon name="arrowRight" size={22} /></button>}
          <img src={viewable[view].url} alt="" className="max-h-[88dvh] max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {viewStory && story && <StoryViewer groups={[story]} startIndex={0} meId={user.id} onClose={() => { setViewStory(false); load(); }} />}
      {celebrate && <MatchModal name={p.full_name} photo={p.photoUrl} chatTo={p.id} onClose={() => setCelebrate(false)} />}
      {showReport && (
        <ReportSheet title={`Report ${p.full_name}`} onClose={() => setShowReport(false)}
          onSubmit={async (r, d) => { await reportUser(user.id, p.id, r, d); setShowReport(false); setMsg("Report sent. Our team will review it."); }} />
      )}
    </div>
  );
}
