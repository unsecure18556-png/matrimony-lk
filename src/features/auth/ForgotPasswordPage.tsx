import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { resetPassword } from "../../services/authService";
import { input, btnPrimary } from "../../components/ui/styles";
import AuthShell from "../../components/ui/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await resetPassword(email).catch(() => {});
    setSent(true);
  }

  return (
    <AuthShell title="Reset password" subtitle="We will email you a link to choose a new one."
      footer={<Link className="font-semibold text-brand-700" to="/login">Back to login</Link>}>
      {sent ? (
        <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">If that email exists, a reset link has been sent.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <input className={input} type="email" placeholder="Your email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className={btnPrimary}>Send reset link</button>
        </form>
      )}
    </AuthShell>
  );
}
