import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginWithEmail, loginWithGoogle } from "../../services/authService";
import { input, btnPrimary, btnOutline } from "../../components/ui/styles";
import AuthShell from "../../components/ui/AuthShell";

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await loginWithEmail(email, password);
      nav("/dashboard");
    } catch (err: any) {
      setError(err.message?.toLowerCase().includes("confirm")
        ? "Please verify your email first (check your inbox)."
        : "Invalid email or password");
    } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to continue."
      footer={<>New here? <Link className="font-semibold text-brand-700" to="/register">Create an account</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <input className={input} type="email" placeholder="Email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" placeholder="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button disabled={busy} className={btnPrimary}>{busy ? "Logging in..." : "Log in"}</button>
        <div className="flex items-center gap-3 text-xs text-stone-400"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div>
        <button type="button" onClick={() => loginWithGoogle()} className={btnOutline}>Continue with Google</button>
        <Link className="block text-center text-sm text-brand-700" to="/forgot-password">Forgot password?</Link>
      </form>
    </AuthShell>
  );
}
