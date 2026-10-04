import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { logout } from "../services/authService";
import { supabase } from "../services/supabase";
import { unreadCount } from "../services/chatService";
import Icon, { Logo, type IconName } from "./ui/Icon";

export default function Layout() {
  const { user, profile, account } = useAuth();
  const loc = useLocation();
  const [pending, setPending] = useState(0);
  const [unread, setUnread] = useState(0);

  // Face verification is mandatory (admins are exempt)
  const needsFace = !!profile && profile.onboarding_complete && !profile.face_verified && account?.role !== "admin";

  useEffect(() => {
    if (!user || needsFace) return;
    supabase.from("interests").select("id", { count: "exact", head: true })
      .eq("to_uid", user.id).eq("status", "pending").then(({ count }) => setPending(count ?? 0));
    unreadCount(user.id).then(setUnread);
  }, [user, needsFace, loc.pathname]);

  if (profile && !profile.onboarding_complete) return <Navigate to="/onboarding" replace />;
  if (needsFace && loc.pathname !== "/verify-face") return <Navigate to="/verify-face" replace />;

  const badge = (n: number) =>
    n > 0 ? <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{n}</span> : null;

  const top = (to: string, label: string, n = 0) => (
    <NavLink to={to} className={({ isActive }) =>
      `whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition ${isActive ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-100"}`}>
      {label}{badge(n)}
    </NavLink>
  );

  const tab = (to: string, icon: IconName, label: string, n = 0) => (
    <NavLink to={to} className={({ isActive }) =>
      `relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? "text-brand-700" : "text-stone-500"}`}>
      {({ isActive }) => (
        <>
          <span className={`flex h-7 w-12 items-center justify-center rounded-full transition ${isActive ? "bg-brand-100" : ""}`}>
            <Icon name={icon} size={20} />
          </span>
          <span>{label}</span>
          {n > 0 && <span className="absolute right-[22%] top-1.5 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{n}</span>}
        </>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-dvh">
      <header className="safe-top sticky top-0 z-20 border-b border-stone-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <Logo size={34} />
            <span className="font-display text-lg font-semibold text-brand-900">Matrimony LK</span>
          </Link>
          {!needsFace && (
            <nav className="ml-4 hidden flex-1 gap-1 md:flex">
              {top("/dashboard", "Home")}
              {top("/search", "Search")}
              {top("/matches", "Best matches")}
              {top("/interests", "Interests", pending)}
              {top("/messages", "Messages", unread)}
              {account?.role === "admin" && top("/admin", "Admin")}
            </nav>
          )}
          <div className="flex-1" />
          {!needsFace && (
            <>
              <Link to="/profile" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 md:flex"><Icon name="user" size={17} />Profile</Link>
              <Link to="/settings" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 md:flex"><Icon name="sliders" size={17} />Settings</Link>
            </>
          )}
          <button onClick={logout} className={`items-center gap-1.5 rounded-full border border-stone-300 px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 ${needsFace ? "flex" : "hidden md:flex"}`}>
            <Icon name="logout" size={16} />Log out
          </button>
        </div>
      </header>

      <main className={`mx-auto max-w-6xl p-3 md:p-5 ${needsFace ? "pb-8" : "pb-24 md:pb-8"}`}>
        <div key={loc.pathname} className="fade-up"><Outlet /></div>
      </main>

      {!needsFace && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-stone-200 bg-white/95 backdrop-blur md:hidden">
          {tab("/dashboard", "home", "Home")}
          {tab("/search", "search", "Search")}
          {tab("/matches", "sparkles", "Matches")}
          {tab("/interests", "mail", "Interests", pending)}
          {tab("/messages", "chat", "Chat", unread)}
          {tab("/more", "menu", "More")}
        </nav>
      )}
    </div>
  );
}
