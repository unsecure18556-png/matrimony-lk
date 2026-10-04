import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { logout } from "../../services/authService";
import { panel } from "../../components/ui/styles";
import Icon, { type IconName } from "../../components/ui/Icon";

export default function MorePage() {
  const { profile, account } = useAuth();
  const item = (to: string, icon: IconName, label: string, sub: string) => (
    <Link to={to} className="flex items-center gap-3 border-b border-stone-100 py-3.5 last:border-0">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name={icon} size={20} /></span>
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-stone-500">{sub}</span>
      </span>
      <Icon name="chevronRight" size={18} className="text-stone-300" />
    </Link>
  );
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className={`${panel} flex items-center gap-3`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 font-display text-xl text-white">{profile?.full_name?.[0]}</span>
        <div>
          <p className="font-display text-lg font-semibold">{profile?.full_name}</p>
          <p className="flex items-center gap-1 text-sm text-emerald-700"><Icon name="shieldCheck" size={15} />Face verified · {account?.plan} plan</p>
        </div>
      </div>
      <div className={panel}>
        {item("/profile", "user", "My profile", "See how others see you")}
        {item("/onboarding", "edit", "Edit profile", "Update details and photos")}
        {item("/verify-face", "shieldCheck", "Face verification", "Manage your verification")}
        {item("/settings", "sliders", "Settings", "Contact, privacy, blocked members")}
        {account?.role === "admin" && item("/admin", "shield", "Admin", "Reports and moderation")}
      </div>
      <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-800 py-3 font-semibold text-white"><Icon name="logout" size={18} />Log out</button>
    </div>
  );
}
