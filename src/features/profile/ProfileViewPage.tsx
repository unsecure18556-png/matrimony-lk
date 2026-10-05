import { useCallback, useEffect, useState } from "react";
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
import { input } from "../../components/ui/styles";
import Icon from "../../components/ui/Icon";
import ReportSheet from "../../components/ReportSheet";
import MatchModal from "../../components/MatchModal";
import { EmptyState, PageLoader } from "../../components/ui/Feedback";

const round = "flex items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/5 transition active:scale-90";
const glass = "flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-ink shadow backdrop-blur";

export default function ProfileViewPage() {
  const { id } = useParams();
  const { user, profile: me } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState<ProfileCard | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [saved, setSaved] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [menu, setMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [readMore, setReadMore] = useState(false);
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
    fetchFeed(user.id, { userId: id, limit: 9 }).then((r) => setPosts(r.posts)).catch(() => {});
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
  const lockedAll = photos.length > 0 && viewable.length === 0;
  const place = [p.district, p.country_living].filter(Boolean).join(", ");
  const about = p.about ?? "";
  const long = about.length > 140;

  const run = async (fn: () => Promise<unknown>, ok = "") => {
    setErr(""); setMsg("");
    try { await fn(); if (ok) setMsg(ok); await load(); } catch (e: any) { setErr(e.message); }
  };

  const groups: [string, [string, string | number | null][]][] = [
    ["Basics", [["Height", p.height_cm ? `${p.height_cm} cm` : null], ["Marital status", p.marital_status], ["Living in", p.country_living]]],
    ["Background", [["Religion", p.religion], ["Ethnicity", p.ethnicity], ["Caste", p.caste], ["Mother tongue", p.mother_tongue], ["Diet", p.diet]]],
    ["Education and family", [["Education", p.education], ["Occupation", p.occupation], ["Family type", p.family_type], ["Father", p.father_occupation], ["Mother", p.mother_occupation], ["Siblings", p.siblings]]],
    ["Horoscope", [["Nakath", p.nakath], ["Rashi", p.rashi]]],
  ];
  const any = (v: string | null) => (!v || v === "any" ? "Any" : v);
  const looking: [string, string][] = [
    ["Age", `${p.pref_age_min ?? 18} to ${p.pref_age_max ?? 80}`], ["Religion", any(p.pref_religion)],
    ["Ethnicity", any(p.pref_ethnicity)], ["District", any(p.pref_district)], ["Marital status", any(p.pref_marital)],
  ];

  /* floating action buttons: pass / interest / shortlist */
  const heartAction = () => {
    if (rel.state === "none") return setShowNote(!showNote);
    if (rel.state === "sent") return run(() => withdrawInterest(rel.interest!.id));
    if (rel.state === "received") return run(async () => { await respondInterest(rel.interest!.id, true); setCelebrate(true); });
    if (rel.state === "connected") return nav(`/messages/${p.id}`);
  };
  const passAction = () => rel.state === "received" ? run(() => respondInterest(rel.interest!.id, false)) : nav(-1);
  const heartLabel = { none: "Send interest", sent: "Interest sent (tap to withdraw)", received: "Accept interest", connected: "Message", declined: "Declined" }[rel.state];

  return (
    <div className="-mx-3 -mt-3 md:mx-auto md:mt-0 md:max-w-xl">
      {/* hero photo */}
      <div className="relative h-[54dvh] max-h-[560px] min-h-[340px] overflow-hidden bg-gradient-to-br from-brand-200 to-brand-100 md:rounded-b-[2rem]">
        {p.photoUrl ? (
          <img src={p.photoUrl} alt="" className="h-full w-full object-cover" onClick={() => viewable.length && setView(0)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-brand-500">
            <Icon name={lockedAll || p.hasPhoto ? "lock" : "user"} size={48} />
            <span className="px-8 text-center text-sm">{p.hasPhoto ? "Photos are shown after your interest is accepted" : "No photo yet"}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent" />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          {isMe ? <span /> : <button onClick={() => nav(-1)} aria-label="Back" className={glass}><Icon name="arrowLeft" size={20} /></button>}
          <div className="relative">
            {isMe ? (
              <Link to="/settings" aria-label="Settings" className={glass}><Icon name="menu" size={20} /></Link>
            ) : (
              <>
                <button onClick={() => setMenu(!menu)} aria-label="More" className={glass}><Icon name="dots" size={20} /></button>
                {menu && (
                  <div className="absolute right-0 top-12 z-20 w-44 overflow-hidden rounded-xl bg-white text-sm shadow-lg ring-1 ring-stone-900/10">
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
        {viewable.length > 1 && (
          <button onClick={() => setView(0)} className="absolute bottom-12 left-4 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white">
            <Icon name="image" size={14} />{viewable.length} photos
          </button>
        )}
      </div>

      {/* sheet */}
      <div className="relative -mt-8 rounded-t-[2rem] bg-white px-5 pb-10 pt-12 shadow-[0_-10px_30px_rgba(58,31,43,.10)]">
        {!isMe && (
          <div className="absolute -top-9 left-0 right-0 flex items-center justify-center gap-5">
            <button onClick={passAction} aria-label={rel.state === "received" ? "Decline" : "Not now"} className={`${round} h-14 w-14 text-brand-500`}><Icon name="x" size={26} strokeWidth={2.4} /></button>
            <button onClick={heartAction} aria-label={heartLabel} disabled={rel.state === "declined"}
              className={`${round} h-[72px] w-[72px] !bg-gradient-to-br from-brand-500 to-brand-700 text-white ring-4 ring-white disabled:opacity-60`}>
              <Icon name={rel.state === "connected" ? "chat" : "heart"} size={32} filled={rel.state !== "connected"} />
            </button>
            <button onClick={async () => { await setShortlisted(user.id, p.id, !saved); setSaved(!saved); }} aria-label={saved ? "Remove from shortlist" : "Shortlist"}
              className={`${round} h-14 w-14 ${saved ? "text-brand-600" : "text-brand-400"}`}><Icon name="star" size={24} filled={saved} /></button>
          </div>
        )}

        {(err || msg || phone) && (
          <div className="mb-3 space-y-2">
            {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
            {msg && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{msg}</p>}
            {phone && <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm"><Icon name="phone" size={16} />Contact number: <b>{phone}</b></p>}
          </div>
        )}

        {!isMe && <p className="mb-3 text-center text-xs font-medium text-stone-500">{heartLabel}</p>}

        {showNote && rel.state === "none" && (
          <div className="mb-4 flex gap-2">
            <input className={input} placeholder="Add a short message (optional)" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="rounded-xl bg-brand-600 px-4 font-semibold text-white" onClick={() => run(async () => { await sendInterest(user.id, p.id, note); setShowNote(false); setNote(""); }, "Interest sent")}>Send</button>
          </div>
        )}

        {/* name */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
              <span className="truncate">{p.full_name}{age ? `, ${age}` : ""}</span>
              {p.face_verified && <Icon name="shieldCheck" size={22} className="shrink-0 text-emerald-600" />}
            </h1>
            <p className="text-sm text-stone-500">{p.occupation ?? "Member"}</p>
          </div>
          {rel.state === "connected" && (
            <Link to={`/messages/${p.id}`} aria-label="Message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name="send" size={20} /></Link>
          )}
        </div>

        {isMe && (
          <div className="mt-4 flex gap-2">
            <Link to="/onboarding" className="flex-1 rounded-xl bg-brand-600 py-2.5 text-center text-sm font-semibold text-white">Edit profile</Link>
            <Link to="/create" className="flex-1 rounded-xl bg-stone-200/80 py-2.5 text-center text-sm font-semibold">New post</Link>
          </div>
        )}

        {/* location */}
        {place && (
          <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
            <div><p className="text-xs uppercase tracking-wide text-stone-400">Location</p>
              <p className="flex items-center gap-1.5 font-medium"><Icon name="mapPin" size={16} className="text-brand-500" />{place}</p></div>
            {match && <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{match.score}% {matchLabel(match.score).split(" ")[0]}</span>}
          </div>
        )}

        {/* about */}
        {about && (
          <div className="mt-5 border-t border-stone-100 pt-4">
            <h2 className="mb-1 font-display text-lg font-semibold">About</h2>
            <p className={`whitespace-pre-line text-sm leading-relaxed text-stone-700 ${readMore ? "" : "line-clamp-3"}`}>{about}</p>
            {long && <button onClick={() => setReadMore(!readMore)} className="mt-1 text-sm font-semibold text-brand-600">{readMore ? "Show less" : "Read more"}</button>}
          </div>
        )}

        {/* interests */}
        {(p.interests?.length ?? 0) > 0 && (
          <div className="mt-5 border-t border-stone-100 pt-4">
            <h2 className="mb-2 font-display text-lg font-semibold">Interests</h2>
            <div className="flex flex-wrap gap-2">
              {p.interests!.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-lg border border-brand-300 bg-brand-50/60 px-3 py-1.5 text-sm text-brand-700">
                  <Icon name="check" size={14} strokeWidth={2.6} />{t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* gallery */}
        {photos.length > 0 && (
          <div className="mt-5 border-t border-stone-100 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Gallery</h2>
              {viewable.length > 0 && <button onClick={() => setView(0)} className="text-sm font-semibold text-brand-600">See all</button>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {photos.slice(0, 6).map((x, i) => x.url ? (
                <button key={x.id} onClick={() => setView(viewable.indexOf(x))}
                  className={`overflow-hidden rounded-xl bg-stone-200 ${i === 0 && photos.length > 2 ? "col-span-2 row-span-2" : ""} aspect-square`}>
                  <img src={x.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ) : (
                <div key={x.id} className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl bg-brand-100 text-brand-400 ${i === 0 && photos.length > 2 ? "col-span-2 row-span-2" : ""}`}>
                  <Icon name="lock" size={22} /><span className="text-[10px]">Private</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* match reasons */}
        {match && match.reasons.length > 0 && (
          <div className="mt-5 border-t border-stone-100 pt-4">
            <h2 className="mb-2 font-display text-lg font-semibold">Why you match</h2>
            <ul className="space-y-1.5 text-sm">
              {match.reasons.map((r) => <li key={r} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-emerald-600" />{r}</li>)}
            </ul>
          </div>
        )}

        {/* details */}
        {groups.map(([title, rows]) => {
          const shown = rows.filter(([, v]) => v !== null && v !== "");
          return shown.length ? (
            <div key={title} className="mt-5 border-t border-stone-100 pt-4">
              <h2 className="mb-1 font-display text-lg font-semibold">{title}</h2>
              {shown.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-1.5 text-sm"><span className="text-stone-500">{k}</span><span className="text-right font-medium">{v}</span></div>
              ))}
            </div>
          ) : null;
        })}

        <div className="mt-5 border-t border-stone-100 pt-4">
          <h2 className="mb-1 font-display text-lg font-semibold">Looking for</h2>
          {looking.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-1.5 text-sm"><span className="text-stone-500">{k}</span><span className="font-medium">{v}</span></div>
          ))}
        </div>

        {/* posts */}
        {posts.length > 0 && (
          <div className="mt-5 border-t border-stone-100 pt-4">
            <h2 className="mb-2 font-display text-lg font-semibold">Posts</h2>
            <div className="grid grid-cols-3 gap-1">
              {posts.map((x) => (
                <Link key={x.id} to={`/post/${x.id}`} className="relative aspect-square overflow-hidden bg-stone-200">
                  {x.images[0] && <img src={x.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  {x.images.length > 1 && <Icon name="grid" size={16} className="absolute right-1.5 top-1.5 text-white drop-shadow" />}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* photo viewer */}
      {view !== null && viewable[view] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" onClick={() => setView(null)}>
          <button aria-label="Close" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"><Icon name="x" size={22} /></button>
          {view > 0 && <button aria-label="Previous" onClick={(e) => { e.stopPropagation(); setView(view - 1); }} className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"><Icon name="arrowLeft" size={22} /></button>}
          {view < viewable.length - 1 && <button aria-label="Next" onClick={(e) => { e.stopPropagation(); setView(view + 1); }} className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"><Icon name="arrowRight" size={22} /></button>}
          <img src={viewable[view].url} alt="" className="max-h-[88dvh] max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {celebrate && <MatchModal name={p.full_name} photo={p.photoUrl} chatTo={p.id} onClose={() => setCelebrate(false)} />}

      {showReport && (
        <ReportSheet title={`Report ${p.full_name}`} onClose={() => setShowReport(false)}
          onSubmit={async (r, d) => { await reportUser(user.id, p.id, r, d); setShowReport(false); setMsg("Report sent. Our team will review it."); }} />
      )}
    </div>
  );
}
