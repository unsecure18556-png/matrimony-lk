import { Link } from "react-router-dom";
import Icon from "./ui/Icon";

export default function VerifyNotice({ what }: { what: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-stone-900/5">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Icon name="shieldCheck" size={32} /></span>
      <h1 className="mt-3 font-display text-2xl font-semibold">Verify your face first</h1>
      <p className="mt-1 text-sm text-stone-600">Only face-verified members can {what}. You can keep browsing in the meantime.</p>
      <Link to="/verify-face" className="mt-5 block rounded-xl bg-brand-600 py-3 font-semibold text-white">Verify now</Link>
      <Link to="/dashboard" className="mt-2 block py-2 text-sm text-stone-500">Back to home</Link>
    </div>
  );
}
