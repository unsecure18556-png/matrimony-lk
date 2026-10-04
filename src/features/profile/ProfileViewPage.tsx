import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getCards, type ProfileCard } from "../../services/cardService";
import { ageFromDob, listPhotos, type Photo } from "../../services/profileService";
import { relationWith, myInterests, respondInterest, sendInterest, withdrawInterest, type Interest } from "../../services/interestService";
import { blockUser, getContact, reportUser, setShortlisted, shortlistIds } from "../../services/socialService";
import { matchLabel, scoreMatch } from "../../services/matchService";
import { btnSmall, btnSmallOutline, input, panel } from "../../components/ui/styles";
import { REPORT_REASONS } from "../../utils/constants";
import Icon from "../../components/ui/Icon";
import { CardSkeletons, EmptyState, PageLoader } from "../../components/ui/Feedback";


export default function ProfileViewPage() {
  const { id } = useParams();
  const { user, profile: me } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState<ProfileCard | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [saved, setSaved] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");

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
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  if (!user) return null;
  if (id === "me") return <Navigate to={`/p/${user.id}`} replace />;
  if (state === "loading") return <PageLoader />;
  if (state === "missing" || !p) return <EmptyState icon="user" title="Profile not available" text="It may have been removed, or you may no longer be able to see it." />;

  const isMe = p.id === user.id;
  const rel = relationWith(interests, user.id, p.id);
  const match = me && !isMe ? scoreMatch(me, p) : null;
  const run = async (fn: () => Promise<unknown>, ok = "") => {
    setErr(""); setMsg("");
    try { await fn(); if (ok) setMsg(ok); await load(); } catch (e: any) { setErr(e.message); }
  };

  const rows: [string, string | number | null][] = [
    ["Age", p.dob ? ageFromDob(p.dob) : null], ["Height", p.height_cm ? `${p.height_cm} cm` : null],
    ["Marital status", p.marital_status], ["District", p.district], ["Living in", p.country_living],
    ["Religion", p.religion], ["Ethnicity", p.ethnicity], ["Caste", p.caste],
    ["Mother tongue", p.mother_tongue], ["Diet", p.diet], ["Education", p.education],
    ["Occupation", p.occupation], ["Family type", p.family_type],
    ["Father", p.father_occupation], ["Mother", p.mother_occupation], ["Siblings", p.siblings],
    ["Nakath", p.nakath], ["Rashi", p.rashi],
  ];
  const locked = !isMe && photos.length > 0 && photos.every((x) => !x.url);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-900/5">
        {p.photoUrl ? (
          <div className="relative">
            <img src={p.photoUrl} alt="" className="h-96 w-full object-cover sm:h-[28rem]" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        ) : (
          <div className="flex h-60 flex-col items-center justify-center gap-2 bg-gradient-to-br from-brand-100 to-gold-50 text-brand-500">
            <Icon name={locked ? "lock" : "user"} size={40} />
            <span className="px-6 text-center text-sm">{locked ? "Photos are visible after your interest is accepted" : "No photo yet"}</span>
          </div>
        )}
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold">{p.full_name}{p.dob ? `, ${ageFromDob(p.dob)}` : ""}</h1>
            {p.face_verified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white"><Icon name="check" size={12} strokeWidth={2.6} />Face verified</span>}
            {match && <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-bold text-gold-700">{match.score}% · {matchLabel(match.score)}</span>}
          </div>
          <p className="text-gray-700">{p.about}</p>
          {match && match.reasons.length > 0 && (
            <ul className="ml-5 list-disc text-sm text-gray-600">{match.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          )}

          {isMe ? (
            <div className="flex gap-2">
              <Link to="/onboarding" className={btnSmall}>Edit profile</Link>
              <Link to="/settings" className={btnSmallOutline}>Settings</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {err && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{err}</p>}
              {msg && <p className="rounded bg-green-50 p-2 text-sm text-green-700">{msg}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {rel.state === "none" && (
                  <>
                    <input className={`${input} w-full sm:max-w-xs`} placeholder="Short message (optional)" maxLength={300}
                      value={note} onChange={(e) => setNote(e.target.value)} />
                    <button className={btnSmall} onClick={() => run(() => sendInterest(user.id, p.id, note), "Interest sent!")}>Send interest</button>
                  </>
                )}
                {rel.state === "sent" && (
                  <>
                    <span className="text-sm text-gray-600">Interest sent, waiting for a reply</span>
                    <button className={btnSmallOutline} onClick={() => run(() => withdrawInterest(rel.interest!.id))}>Withdraw</button>
                  </>
                )}
                {rel.state === "received" && (
                  <>
                    <span className="text-sm text-gray-600">They sent you an interest</span>
                    <button className={btnSmall} onClick={() => run(() => respondInterest(rel.interest!.id, true), "Accepted!")}>Accept</button>
                    <button className={btnSmallOutline} onClick={() => run(() => respondInterest(rel.interest!.id, false))}>Decline</button>
                  </>
                )}
                {rel.state === "connected" && <Link to={`/messages/${p.id}`} className={btnSmall}><Icon name="chat" size={16} />Message</Link>}
                {rel.state === "declined" && <span className="text-sm text-gray-500">They declined your interest</span>}
                <button className={btnSmallOutline} onClick={async () => { await setShortlisted(user.id, p.id, !saved); setSaved(!saved); }}>
                  <Icon name="heart" size={16} filled={saved} />{saved ? "Shortlisted" : "Shortlist"}
                </button>
              </div>
              {phone && <p className="rounded bg-emerald-50 p-2 text-sm"><span className="inline-flex items-center gap-2"><Icon name="phone" size={16} />Contact number: <b>{phone}</b></span></p>}
              <div className="flex gap-3 pt-1 text-xs text-gray-500">
                <button onClick={() => setShowReport(!showReport)} className="underline">Report</button>
                <button className="underline" onClick={async () => {
                  if (confirm(`Block ${p.full_name}? You will no longer see each other.`)) {
                    await blockUser(user.id, p.id, p.full_name); nav("/search");
                  }
                }}>Block</button>
              </div>
              {showReport && (
                <div className="space-y-2 rounded-lg border p-3">
                  <select className={input} value={reason} onChange={(e) => setReason(e.target.value)}>
                    {REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <textarea className={input} rows={2} placeholder="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
                  <button className={btnSmall} onClick={() => run(async () => { await reportUser(user.id, p.id, reason, details); setShowReport(false); }, "Report sent. Our team will review it.")}>Submit report</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={panel}>
        <h2 className="mb-3 font-display text-xl font-semibold">Details</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><dt className="text-xs uppercase tracking-wide text-stone-400">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>
      </div>

      {photos.some((x) => x.url) && photos.length > 1 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.filter((x) => x.url).map((x) => <img key={x.id} src={x.url} alt="" className="aspect-square rounded-lg object-cover" />)}
        </div>
      )}
    </div>
  );
}
