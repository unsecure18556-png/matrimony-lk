import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { saveProfile } from "../../services/profileService";
import { getContact, listBlocked, saveContact, unblockUser } from "../../services/socialService";
import { deleteFaceData } from "../../services/faceService";
import { logout, resetPassword } from "../../services/authService";
import { btnPrimary, input } from "../../components/ui/styles";
import Icon, { type IconName } from "../../components/ui/Icon";
import Toggle from "../../components/ui/Toggle";
import { useTheme, type Theme } from "../../theme/ThemeContext";

interface Row { icon: IconName; label: string; to: string }
interface Group { title: string; rows: Row[] }

const TITLES: Record<string, string> = {
  appearance: "Appearance", contact: "Contact number", login: "Email and password", privacy: "Photo privacy",
  blocked: "Blocked members", face: "Face verification", safety: "Safety tips", about: "About",
};

function Bar({ title, back }: { title: string; back: () => void }) {
  return (
    <div className="mb-4 grid grid-cols-[44px_1fr_44px] items-center">
      <button onClick={back} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-stone-100">
        <Icon name="arrowLeft" size={22} />
      </button>
      <h1 className="text-center font-display text-xl font-semibold">{title}</h1>
      <span />
    </div>
  );
}

const card = "overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5";

export default function SettingsPage() {
  const { section } = useParams();
  const nav = useNavigate();
  const { user, profile, account, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [q, setQ] = useState("");
  const [phone, setPhone] = useState("");
  const [blocked, setBlocked] = useState<{ blocked: string; blocked_name: string | null }[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) return;
    getContact(user.id).then((p) => setPhone(p ?? ""));
    listBlocked(user.id).then(setBlocked);
  }, [user]);
  useEffect(() => { setMsg(""); setErr(""); }, [section]);

  if (!user || !profile) return null;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(""); setMsg("");
    try { await fn(); await refreshProfile(); setMsg(ok); } catch (e: any) { setErr(e.message); }
  };
  const notice = (<>
    {msg && <p className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800">{msg}</p>}
    {err && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
  </>);

  /* ---------------- main menu ---------------- */
  if (!section) {
    const groups: Group[] = [
      { title: "Your account", rows: [
        { icon: "edit", label: "Edit profile", to: "/onboarding" },
        { icon: "sun", label: "Appearance", to: "/settings/appearance" },
        { icon: "phone", label: "Contact number", to: "/settings/contact" },
        { icon: "key", label: "Email and password", to: "/settings/login" },
        { icon: "bookmark", label: "Saved posts", to: "/saved" },
        { icon: "bell", label: "Notifications", to: "/notifications" },
      ]},
      { title: "Who can see your content", rows: [
        { icon: "eye", label: "Photo privacy", to: "/settings/privacy" },
        { icon: "ban", label: "Blocked members", to: "/settings/blocked" },
      ]},
      { title: "Verification", rows: [
        { icon: "shieldCheck", label: "Face verification", to: "/settings/face" },
      ]},
      { title: "Support", rows: [
        { icon: "help", label: "Safety tips", to: "/settings/safety" },
        { icon: "info", label: "About", to: "/settings/about" },
      ]},
    ];
    if (account?.role === "admin") groups.push({ title: "Admin", rows: [{ icon: "shield", label: "Moderation", to: "/admin" }] });
    const needle = q.trim().toLowerCase();
    const shown = groups.map((g) => ({ ...g, rows: g.rows.filter((r) => !needle || r.label.toLowerCase().includes(needle)) })).filter((g) => g.rows.length);

    return (
      <div className="mx-auto max-w-xl">
        <Bar title="Settings" back={() => nav(-1)} />
        <div className="relative mb-5">
          <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className={`${input} rounded-xl bg-stone-100 pl-10`} placeholder="Search settings" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="space-y-5">
          {shown.map((g) => (
            <section key={g.title}>
              <h2 className="mb-1.5 px-1 font-sans text-xs font-semibold uppercase tracking-wide text-stone-500">{g.title}</h2>
              <div className={card}>
                {g.rows.map((r) => (
                  <Link key={r.label} to={r.to} className="flex items-center gap-4 border-b border-stone-100 px-4 py-3.5 last:border-0 active:bg-stone-100">
                    <Icon name={r.icon} size={22} className="text-ink" />
                    <span className="flex-1">{r.label}</span>
                    <Icon name="chevronRight" size={18} className="text-stone-400" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
          {shown.length === 0 && <p className="py-8 text-center text-sm text-stone-500">No settings found.</p>}
          <div className={card}>
            <button onClick={logout} className="flex w-full items-center gap-4 px-4 py-3.5 text-left font-medium text-brand-600 active:bg-stone-100">
              <Icon name="logout" size={22} />Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- sub screens ---------------- */
  const back = () => nav("/settings");
  let body: React.ReactNode = <p className="text-stone-500">This setting does not exist.</p>;

  if (section === "appearance") body = (
    <div className={card}>
      {([["system", "Match my device"], ["light", "Light"], ["dark", "Dark"]] as [Theme, string][]).map(([v, t]) => (
        <button key={v} onClick={() => setTheme(v)} className="flex w-full items-center gap-3 border-b border-stone-100 px-4 py-4 text-left last:border-0 active:bg-stone-100">
          <Icon name={v === "dark" ? "moon" : v === "light" ? "sun" : "phoneOtp"} size={20} />
          <span className="flex-1 font-medium">{t}</span>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${theme === v ? "border-brand-600 bg-brand-600 text-white" : "border-stone-300"}`}>{theme === v && <Icon name="check" size={14} strokeWidth={3} />}</span>
        </button>
      ))}
    </div>
  );

  if (section === "contact") body = (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">Only members whose interest you have accepted can see this number.</p>
      <input className={input} placeholder="+94 7X XXX XXXX" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <button className={btnPrimary} onClick={() => run(() => saveContact(user.id, phone.trim()), "Contact number saved")}>Save</button>
    </div>
  );

  if (section === "login") body = (
    <div className="space-y-4">
      <div className={`${card} px-4 py-3`}>
        <p className="text-xs uppercase tracking-wide text-stone-400">Email</p>
        <p className="font-medium">{user.email}</p>
      </div>
      <p className="text-sm text-stone-500">To change your password, we will email you a secure link.</p>
      <button className={btnPrimary} onClick={() => run(() => resetPassword(user.email ?? ""), "Password reset email sent")}>Send password reset email</button>
    </div>
  );

  if (section === "privacy") {
    const opts = [
      { v: "public", t: "All verified members", d: "Any face-verified member can see your photos." },
      { v: "after_interest", t: "Only after I accept", d: "Photos stay hidden until you accept someone's interest." },
    ];
    body = (
      <div className={card}>
        {opts.map((o) => (
          <button key={o.v} onClick={() => run(() => saveProfile(user.id, { photo_visibility: o.v }), "Privacy updated")}
            className="flex w-full items-center gap-3 border-b border-stone-100 px-4 py-4 text-left last:border-0 active:bg-stone-100">
            <span className="flex-1"><span className="block font-medium">{o.t}</span><span className="block text-sm text-stone-500">{o.d}</span></span>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${profile.photo_visibility === o.v ? "border-brand-600 bg-brand-600 text-white" : "border-stone-300"}`}>
              {profile.photo_visibility === o.v && <Icon name="check" size={14} strokeWidth={3} />}
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (section === "blocked") body = blocked.length === 0 ? (
    <p className="py-10 text-center text-stone-500">You have not blocked anyone.</p>
  ) : (
    <div className={card}>
      {blocked.map((b) => (
        <div key={b.blocked} className="flex items-center justify-between border-b border-stone-100 px-4 py-3 last:border-0">
          <span className="font-medium">{b.blocked_name ?? "Member"}</span>
          <button className="rounded-lg bg-stone-200/80 px-3.5 py-1.5 text-sm font-semibold" onClick={async () => {
            await unblockUser(user.id, b.blocked); setBlocked(await listBlocked(user.id));
          }}>Unblock</button>
        </div>
      ))}
    </div>
  );

  if (section === "face") body = (
    <div className="space-y-4">
      <div className={`${card} flex items-center gap-3 px-4 py-4`}>
        <span className={`flex h-11 w-11 items-center justify-center rounded-full ${profile.face_verified ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
          <Icon name={profile.face_verified ? "shieldCheck" : "alert"} size={24} />
        </span>
        <div><p className="font-medium">{profile.face_verified ? "Verified" : "Not verified"}</p>
          <p className="text-sm text-stone-500">{profile.face_verified ? "Your profile shows the Verified badge." : "Verify to like, comment, send interests, chat and post."}</p></div>
      </div>
      {!profile.face_verified && <Link to="/verify-face" className={`${btnPrimary} block text-center`}>Verify now</Link>}
      {profile.face_verified && (
        <>
          <div className={`${card} flex items-center gap-3 px-4 py-4`}>
            <span className="flex-1"><span className="block font-medium">Similar faces</span>
              <span className="block text-sm text-stone-500">Let your profile appear in similar-face suggestions.</span></span>
            <Toggle label="Similar faces" checked={profile.face_match_opt_in}
              onChange={(v) => run(() => saveProfile(user.id, { face_match_opt_in: v }), "Updated")} />
          </div>
          <button className="w-full rounded-xl border border-red-200 bg-white py-3 font-medium text-red-600"
            onClick={() => { if (confirm("Delete your face data? You will need to verify again to like, comment, send interests, chat and post.")) run(deleteFaceData, "Face data deleted"); }}>
            Delete my face data
          </button>
          <p className="text-xs text-stone-500">Only a numeric face template is stored, never your selfie. Deleting it removes the Verified badge.</p>
        </>
      )}
    </div>
  );

  if (section === "safety") body = (
    <ul className={`${card} divide-y divide-stone-100 text-sm`}>
      {["Never send money or share bank, card or OTP details with anyone you meet here.",
        "Meet first in a public place and tell your family where you are going.",
        "Check the Verified badge, and be careful with profiles that rush you to move to another app.",
        "Use Report or Block on any profile or message that feels wrong. Our team reviews every report."].map((t) => (
        <li key={t} className="flex gap-3 px-4 py-3.5"><Icon name="shieldCheck" size={18} className="mt-0.5 text-brand-600" /><span>{t}</span></li>
      ))}
    </ul>
  );

  if (section === "about") body = (
    <div className={`${card} divide-y divide-stone-100 text-sm`}>
      <div className="flex justify-between px-4 py-3.5"><span>App</span><span className="text-stone-500">Matrimony LK</span></div>
      <div className="flex justify-between px-4 py-3.5"><span>Version</span><span className="text-stone-500">1.0</span></div>
      <div className="flex justify-between px-4 py-3.5"><span>Plan</span><span className="text-stone-500 capitalize">{account?.plan}</span></div>
    </div>
  );

  return (
    <div className="mx-auto max-w-xl">
      <Bar title={TITLES[section] ?? "Settings"} back={back} />
      {notice}
      {body}
    </div>
  );
}
