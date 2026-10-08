import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerWithEmail, loginWithGoogle, type CreatingFor } from "../../services/authService";
import { input, btnPrimary, btnOutline } from "../../components/ui/styles";
import AuthShell from "../../components/ui/AuthShell";

export default function RegisterPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", creatingFor: "self" as CreatingFor });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) return setError("Password must be at least 8 characters");
    setBusy(true);
    try {
      await registerWithEmail(form.name, form.email, form.password, form.creatingFor);
      nav("/verify-email", { state: { email: form.email } });
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <AuthShell title="Create your account" subtitle="Takes two minutes. You can verify your face later to like, chat and send interests."
      footer={<>Already a member? <Link className="font-semibold text-brand-700" to="/login">Log in</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <select className={input} value={form.creatingFor} onChange={(e) => set("creatingFor", e.target.value)}>
          <option value="self">Profile for myself</option>
          <option value="son">Profile for my son</option>
          <option value="daughter">Profile for my daughter</option>
          <option value="brother">Profile for my brother</option>
          <option value="sister">Profile for my sister</option>
          <option value="friend">Profile for a friend</option>
        </select>
        <input className={input} placeholder="Full name of the candidate" required value={form.name} onChange={(e) => set("name", e.target.value)} />
        <input className={input} type="email" placeholder="Email" autoComplete="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
        <input className={input} type="password" placeholder="Password (min 8 characters)" autoComplete="new-password" required value={form.password} onChange={(e) => set("password", e.target.value)} />
        <button disabled={busy} className={btnPrimary}>{busy ? "Creating..." : "Create account"}</button>
        <div className="flex items-center gap-3 text-xs text-stone-400"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div>
        <button type="button" onClick={() => loginWithGoogle()} className={btnOutline}>Continue with Google</button>
      </form>
    </AuthShell>
  );
}
