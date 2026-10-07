import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { listPhotos } from "../../services/profileService";
import { descriptorFrom, enrollFace, loadFaceApi, loadPhotoImage, type EnrollResult } from "../../services/faceService";
import { btnPrimary, btnOutline, panel } from "../../components/ui/styles";
import Icon from "../../components/ui/Icon";

export default function FaceVerifyPage() {
  const { profile, refreshProfile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [consent, setConsent] = useState(false);
  const [optIn, setOptIn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<EnrollResult | null>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  async function startCam() {
    setError("");
    try {
      setBusy("Starting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640 } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCamOn(true);
      setBusy("Loading face recognition (first time only, about 7 MB)...");
      await loadFaceApi();
      setBusy("");
    } catch (e: any) {
      setBusy("");
      setError(e.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser settings, or open the app in its own browser tab."
        : e.message);
    }
  }

  async function verify() {
    if (!profile || !videoRef.current) return;
    setError(""); setResult(null);
    try {
      setBusy("Reading your profile photo...");
      const photos = await listPhotos(profile.id);
      const main = photos.find((p) => p.is_primary) ?? photos[0];
      if (!main) throw new Error("Add a profile photo first.");
      const photoDesc = await descriptorFrom(await loadPhotoImage(main.path)).catch((e) => { throw new Error(`Profile photo: ${e.message}`); });
      setBusy("Checking your selfie...");
      const selfieDesc = await descriptorFrom(videoRef.current).catch((e) => { throw new Error(`Selfie: ${e.message}`); });
      setBusy("Comparing...");
      const r = await enrollFace(photoDesc, selfieDesc, optIn);
      setResult(r);
      if (r.verified) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setCamOn(false);
        await refreshProfile();
      }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(""); }
  }

  if (!profile) return null;

  if (profile.face_verified)
    return (
      <div className={`${panel} mx-auto max-w-lg space-y-4 text-center`}>
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Icon name="shieldCheck" size={32} /></span>
        <h1 className="font-display text-2xl font-semibold text-emerald-800">You are verified</h1>
        <p className="text-sm text-stone-600">
          Your profile now shows the Verified badge. Similar-face suggestions: <b>{profile.face_match_opt_in ? "on" : "off"}</b>.
          Manage this in <Link className="font-medium text-brand-700 underline" to="/settings">Settings</Link>.
        </p>
        <Link to="/dashboard" className={`${btnPrimary} inline-block`}>Continue to the app</Link>
      </div>
    );

  return (
    <div className={`${panel} mx-auto max-w-lg space-y-5`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name="shieldCheck" size={24} /></span>
        <div>
          <h1 className="font-display text-2xl font-semibold">Verify your face</h1>
          <p className="text-sm text-stone-500">Needed to like, comment, send interests, chat and post. It keeps the community free of fake profiles.</p>
        </div>
      </div>

      <ol className="grid grid-cols-3 gap-2 text-center text-xs text-stone-600">
        {["Agree", "Take a selfie", "Get verified"].map((t, i) => (
          <li key={t} className="rounded-xl bg-stone-50 p-2"><span className="mb-1 mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{i + 1}</span>{t}</li>
        ))}
      </ol>

      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I agree to my face template being created and stored for verification and duplicate-account detection. Only a numeric template is saved, not a photo, and I can delete it any time in Settings.</span>
      </label>
      <label className="flex items-start gap-2.5 text-sm text-stone-600">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
        <span>Optional: let my profile appear in "Similar faces" suggestions.</span>
      </label>

      <div className="relative overflow-hidden rounded-2xl bg-stone-900">
        <video ref={videoRef} playsInline muted className={`aspect-[4/3] w-full object-cover -scale-x-100 ${camOn ? "" : "hidden"}`} />
        {!camOn && (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-stone-400">
            <Icon name="camera" size={36} /><span className="text-sm">Camera is off</span>
          </div>
        )}
        {camOn && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[78%] w-[52%] rounded-[50%] border-2 border-dashed border-white/70" />
          </div>
        )}
      </div>

      {busy && <p className="flex items-center gap-2 text-sm text-brand-700"><span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />{busy}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {result && !result.verified && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          The selfie did not match your profile photo (score {result.distance.toFixed(2)}). Use good lighting and face the
          camera. If your main photo is unclear or does not show only you, change it first.
        </p>
      )}

      {!camOn ? (
        <button className={btnPrimary} disabled={!consent || !!busy} onClick={startCam}>Start camera</button>
      ) : (
        <button className={btnPrimary} disabled={!!busy} onClick={verify}>Take selfie and verify</button>
      )}
      <Link to="/onboarding?step=4" className={`${btnOutline} block text-center text-sm`}>Change my profile photo</Link>
      <Link to="/dashboard" className="block text-center text-sm font-medium text-stone-500">Skip for now</Link>
      <p className="text-center text-xs text-stone-400">Tip: if the camera is blocked in the editor preview, open the app in its own browser tab.</p>
    </div>
  );
}
