import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { updatePassword } from "../../services/authService";
import { useAuth } from "./AuthContext";
import { input, btnPrimary } from "../../components/ui/styles";
import AuthShell from "../../components/ui/AuthShell";
import { PageLoader } from "../../components/ui/Feedback";

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters");
    try { await updatePassword(password); nav("/dashboard"); }
    catch (err: any) { setError(err.message); }
  }

  if (loading) return <PageLoader />;
  return (
    <AuthShell title="Choose a new password"
      footer={<Link className="font-semibold text-brand-700" to="/login">Back to login</Link>}>
      {!user ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">This reset link is invalid or has expired. Request a new one.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <input className={input} type="password" placeholder="New password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className={btnPrimary}>Save password</button>
        </form>
      )}
    </AuthShell>
  );
}
