import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { saveProfile } from "../../services/profileService";
import { getContact, listBlocked, saveContact, unblockUser } from "../../services/socialService";
import { deleteFaceData } from "../../services/faceService";
import { logout } from "../../services/authService";
import { btnSmall, btnSmallOutline, input, panel } from "../../components/ui/styles";

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [phone, setPhone] = useState("");
  const [blocked, setBlocked] = useState<{ blocked: string; blocked_name: string | null }[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) return;
    getContact(user.id).then((p) => setPhone(p ?? ""));
    listBlocked(user.id).then(setBlocked);
  }, [user]);

  if (!user || !profile) return null;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(""); setMsg("");
    try { await fn(); await refreshProfile(); setMsg(ok); } catch (e: any) { setErr(e.message); }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {msg && <p className="rounded bg-green-50 p-2 text-sm text-green-700">{msg}</p>}
      {err && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{err}</p>}

      <div className={`${panel} space-y-2`}>
        <h2 className="font-bold">Contact number</h2>
        <p className="text-sm text-gray-500">Only shown to members whose interest you have accepted.</p>
        <input className={input} placeholder="+94 7X XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className={btnSmall} onClick={() => run(() => saveContact(user.id, phone.trim()), "Contact saved")}>Save</button>
      </div>

      <div className={`${panel} space-y-2`}>
        <h2 className="font-bold">Photo privacy</h2>
        <select className={input} value={profile.photo_visibility}
          onChange={(e) => run(() => saveProfile(user.id, { photo_visibility: e.target.value }), "Privacy updated")}>
          <option value="public">All members can see my photos</option>
          <option value="after_interest">Only members whose interest I accepted</option>
        </select>
      </div>

      <div className={`${panel} space-y-2`}>
        <h2 className="font-bold">Face data</h2>
        <p className="text-sm text-gray-500">Status: {profile.face_verified ? "Verified" : "Not verified"}</p>
        {profile.face_verified && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={profile.face_match_opt_in}
                onChange={(e) => run(() => saveProfile(user.id, { face_match_opt_in: e.target.checked }), "Updated")} />
              Appear in "Similar faces" suggestions
            </label>
            <button className={btnSmallOutline} onClick={() => { if (confirm("Delete your face data? Face verification is required, so you will need to verify again to keep using the app.")) run(deleteFaceData, "Face data deleted"); }}>Delete my face data</button>
          </>
        )}
      </div>

      <div className={`${panel} space-y-2`}>
        <h2 className="font-bold">Blocked members</h2>
        {blocked.length === 0 && <p className="text-sm text-gray-500">No one blocked.</p>}
        {blocked.map((b) => (
          <div key={b.blocked} className="flex items-center justify-between text-sm">
            <span>{b.blocked_name ?? "Member"}</span>
            <button className={btnSmallOutline} onClick={async () => {
              await unblockUser(user.id, b.blocked);
              setBlocked(await listBlocked(user.id));
            }}>Unblock</button>
          </div>
        ))}
      </div>

      <button onClick={logout} className="rounded bg-gray-800 px-4 py-2 text-white">Log out</button>
    </div>
  );
}
