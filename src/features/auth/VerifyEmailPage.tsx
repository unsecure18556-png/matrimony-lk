import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { resendVerification } from "../../services/authService";
import { btnOutline, btnPrimary } from "../../components/ui/styles";
import AuthShell from "../../components/ui/AuthShell";
import Icon from "../../components/ui/Icon";

export default function VerifyEmailPage() {
  const email = (useLocation().state as { email?: string } | null)?.email;
  const [msg, setMsg] = useState("");
  return (
    <AuthShell title="Check your email">
      <div className="space-y-4 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Icon name="mail" size={26} /></span>
        <p className="text-sm text-stone-600">
          We sent a verification link{email ? <> to <b>{email}</b></> : ""}. Open it, then log in.
        </p>
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        {email && (
          <button className={btnOutline} onClick={async () => {
            const { error } = await resendVerification(email);
            setMsg(error ? error.message : "Email sent again.");
          }}>Resend email</button>
        )}
        <Link to="/login" className={`${btnPrimary} block`}>Go to login</Link>
      </div>
    </AuthShell>
  );
}
