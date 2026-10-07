import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  ageFromDob, calcCompletion, getProfile, listPhotos, saveProfile, type Profile,
} from "../../services/profileService";
import { SelectField, TextArea, TextField } from "../../components/ui/Fields";
import PhotoManager from "../profile/PhotoManager";
import Icon from "../../components/ui/Icon";
import { btnOutline, btnPrimary } from "../../components/ui/styles";
import {
  DIETS, DISTRICTS, INTERESTS, EDUCATION, ETHNICITIES, FAMILY_TYPES, LANGUAGES, MARITAL, NAKATH, RASHI, RELIGIONS,
} from "../../utils/constants";

const STEPS = ["Basics", "Background", "Education & family", "About you", "Photos"];

export default function OnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState<Partial<Profile>>({});
  const [sp] = useSearchParams();
  const [step, setStep] = useState(Math.min(4, Math.max(0, Number(sp.get("step")) || 0)));
  const [photoCount, setPhotoCount] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const uid = user!.id;
  const set = (k: keyof Profile, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v: string) => (v === "" ? null : Number(v));

  useEffect(() => {
    getProfile(uid).then((p) => { setForm(p); setReady(true); });
    listPhotos(uid).then((l) => setPhotoCount(l.length));
  }, [uid]);

  function validate(): string {
    if (step === 0) {
      if (!form.full_name?.trim()) return "Please enter the full name.";
      if (!form.gender || !form.dob || !form.height_cm || !form.marital_status || !form.district)
        return "Please fill in all fields.";
      if (ageFromDob(form.dob) < 18) return "You must be at least 18 years old.";
    }
    if (step === 1 && (!form.religion || !form.ethnicity || !form.mother_tongue))
      return "Religion, ethnicity and mother tongue are required.";
    if (step === 2 && (!form.education || !form.occupation))
      return "Education and occupation are required.";
    if (step === 3 && (form.about ?? "").trim().length < 30)
      return "Please write at least 30 characters about yourself.";
    return "";
  }

  async function next() {
    const msg = validate();
    if (msg) return setError(msg);
    setError("");
    setBusy(true);
    try {
      await saveProfile(uid, { ...form, completion_score: calcCompletion(form, photoCount) });
      setStep((s) => s + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (photoCount < 1) return setError("Please add at least one photo.");
    setBusy(true);
    try {
      await saveProfile(uid, {
        ...form,
        onboarding_complete: true,
        completion_score: calcCompletion(form, photoCount),
      });
      await refreshProfile();
      nav("/dashboard");
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (!ready) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-dvh p-3 sm:p-4">
      <div className="mx-auto max-w-xl space-y-5 rounded-2xl bg-white p-4 shadow sm:p-6">
        <div>
          <div className="flex items-center">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < step ? "bg-brand-600 text-white" : i === step ? "bg-brand-600 text-white ring-4 ring-brand-100" : "bg-stone-200 text-stone-500"}`}>{i < step ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}</span>
                {i < STEPS.length - 1 && <span className={`mx-1 h-0.5 flex-1 ${i < step ? "bg-brand-600" : "bg-stone-200"}`} />}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-stone-500">Step {step + 1} of {STEPS.length}</p>
          <h1 className="font-display text-2xl font-semibold text-brand-900">{STEPS[step]}</h1>
        </div>

        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

        {step === 0 && (
          <div className="space-y-3">
            <TextField label="Full name" value={form.full_name} onChange={(v) => set("full_name", v)} />
            <SelectField label="Gender of the candidate" value={form.gender}
              onChange={(v) => set("gender", v)} options={["male", "female"]} />
            <TextField label="Date of birth" type="date" value={form.dob}
              onChange={(v) => set("dob", v)} />
            <TextField label="Height (cm)" type="number" min={120} max={230} value={form.height_cm}
              onChange={(v) => set("height_cm", num(v))} />
            <SelectField label="Marital status" value={form.marital_status}
              onChange={(v) => set("marital_status", v)} options={MARITAL} />
            <SelectField label="District (home town)" value={form.district}
              onChange={(v) => set("district", v)} options={DISTRICTS} />
            <TextField label="Country currently living in" value={form.country_living}
              onChange={(v) => set("country_living", v)} />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <SelectField label="Religion" value={form.religion}
              onChange={(v) => set("religion", v)} options={RELIGIONS} />
            <SelectField label="Ethnicity" value={form.ethnicity}
              onChange={(v) => set("ethnicity", v)} options={ETHNICITIES} />
            <TextField label="Caste (optional)" value={form.caste}
              onChange={(v) => set("caste", v)} />
            <SelectField label="Mother tongue" value={form.mother_tongue}
              onChange={(v) => set("mother_tongue", v)} options={LANGUAGES} />
            <SelectField label="Diet" value={form.diet}
              onChange={(v) => set("diet", v)} options={DIETS} />
            <p className="pt-2 text-sm font-semibold text-gray-700">Horoscope (optional)</p>
            <SelectField label="Nakath" value={form.nakath}
              onChange={(v) => set("nakath", v)} options={NAKATH} />
            <SelectField label="Rashi" value={form.rashi}
              onChange={(v) => set("rashi", v)} options={RASHI} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <SelectField label="Highest education" value={form.education}
              onChange={(v) => set("education", v)} options={EDUCATION} />
            <TextField label="Occupation" placeholder="e.g. Software engineer" value={form.occupation}
              onChange={(v) => set("occupation", v)} />
            <SelectField label="Family type" value={form.family_type}
              onChange={(v) => set("family_type", v)} options={FAMILY_TYPES} />
            <TextField label="Father's occupation" value={form.father_occupation}
              onChange={(v) => set("father_occupation", v)} />
            <TextField label="Mother's occupation" value={form.mother_occupation}
              onChange={(v) => set("mother_occupation", v)} />
            <TextField label="Number of siblings" type="number" min={0} max={20} value={form.siblings}
              onChange={(v) => set("siblings", num(v))} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <TextArea label="About the candidate" value={form.about}
              placeholder="Personality, interests, values, what you are looking for..."
              onChange={(v) => set("about", v)} />
            <div>
              <p className="text-sm font-medium text-gray-700">Interests</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {INTERESTS.map((t) => {
                  const on = (form.interests ?? []).includes(t);
                  return (
                    <button type="button" key={t}
                      onClick={() => set("interests", on ? (form.interests ?? []).filter((x) => x !== t) : [...(form.interests ?? []), t])}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-brand-600 bg-brand-600 text-white" : "border-stone-300 bg-white text-stone-600"}`}>{t}</button>
                  );
                })}
              </div>
            </div>
            <p className="pt-2 text-sm font-semibold text-gray-700">Partner preferences</p>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Min age" type="number" min={18} max={80} value={form.pref_age_min}
                onChange={(v) => set("pref_age_min", num(v))} />
              <TextField label="Max age" type="number" min={18} max={80} value={form.pref_age_max}
                onChange={(v) => set("pref_age_max", num(v))} />
            </div>
            <SelectField label="Preferred religion" value={form.pref_religion}
              onChange={(v) => set("pref_religion", v)} options={["any", ...RELIGIONS]} />
            <SelectField label="Preferred ethnicity" value={form.pref_ethnicity}
              onChange={(v) => set("pref_ethnicity", v)} options={["any", ...ETHNICITIES]} />
            <SelectField label="Preferred district" value={form.pref_district}
              onChange={(v) => set("pref_district", v)} options={["any", ...DISTRICTS]} />
            <SelectField label="Preferred marital status" value={form.pref_marital}
              onChange={(v) => set("pref_marital", v)} options={["any", ...MARITAL]} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <PhotoManager uid={uid} onCount={setPhotoCount} />
            <SelectField label="Who can see my photos?" value={form.photo_visibility}
              onChange={(v) => set("photo_visibility", v)} options={["public", "after_interest"]} />
            <p className="text-xs text-gray-500">
              "after_interest" hides photos until you accept an interest. We enforce this in Phase 3.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          {step > 0 && (
            <button className={btnOutline} onClick={() => { setError(""); setStep(step - 1); }}>Back</button>
          )}
          {step < STEPS.length - 1 ? (
            <button className={btnPrimary} disabled={busy} onClick={next}>
              {busy ? "Saving..." : "Save & continue"}
            </button>
          ) : (
            <button className={btnPrimary} disabled={busy} onClick={finish}>
              {busy ? "Saving..." : "Finish"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
