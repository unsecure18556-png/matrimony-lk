import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { logout } from "../services/authService";
import { supabase } from "../services/supabase";
import { subscribeIncoming, unreadCount } from "../services/chatService";
import { unreadNotificationCount } from "../services/notificationService";
import Icon, { type IconName } from "./ui/Icon";
import BrandLogo from "./BrandLogo";
import { useTheme } from "../theme/ThemeContext";
import { VerifyGateProvider } from "./VerifyGate";

export default function Layout() {
  const { user, profile, account } = useAuth();
  const loc = useLocation();
  const [pending, setPending] = useState(0);
  const [unread, setUnread] = useState(0);
  const [bell, setBell] = useState(0);
  const [hideBanner, setHideBanner] = useState(() => sessionStorage.getItem("hide_verify_banner") === "1");
  const { resolved, toggle } = useTheme();

  // Members can browse without verifying; a banner invites them to verify (admins are exempt)
  const unverified = !!profile && profile.onboarding_complete && !profile.face_verified && account?.role !== "admin";

  useEffect(() => {
    if (!user) return;
    supabase.from("interests").select("id", { count: "exact", head: true })
      .eq("to_uid", user.id).eq("status", "pending").then(({ count }) => setPending(count ?? 0));
    unreadCount(user.id).then(setUnread);
    unreadNotificationCount(user.id).then(setBell);
  }, [user, loc.pathname]);

  // keep badges live: refresh when a chat is opened/read or a new message arrives
  useEffect(() => {
    if (!user) return;
    const refresh = () => { unreadCount(user.id).then(setUnread); unreadNotificationCount(user.id).then(setBell); };
    window.addEventListener("chat-read", refresh);
    const off = subscribeIncoming(user.id, refresh);
    return () => { window.removeEventListener("chat-read", refresh); off(); };
  }, [user]);

  if (profile && !profile.onboarding_complete) return <Navigate to="/onboarding" replace />;

  const top = (to: string, label: string, n = 0, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) =>
      `whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition ${isActive ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-100"}`}>
      {label}{n > 0 && <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{n}</span>}
    </NavLink>
  );

  const tab = (to: string, icon: IconName, label: string, n = 0) => (
    <NavLink to={to} className={({ isActive }) =>
      `relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? "text-brand-700" : "text-stone-500"}`}>
      {({ isActive }) => (
        <>
          <span className={`flex h-7 w-11 items-center justify-center rounded-full transition ${isActive ? "bg-brand-100" : ""}`}><Icon name={icon} size={20} /></span>
          <span>{label}</span>
          {n > 0 && <span className="absolute right-[18%] top-1.5 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{n}</span>}
        </>
      )}
    </NavLink>
  );

  const headerIcon = (to: string, icon: IconName, label: string, n: number) => (
    <Link to={to} aria-label={label} className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-stone-100">
      <Icon name={icon} size={25} strokeWidth={1.7} />
      {n > 0 && <span className="absolute right-0 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{n > 9 ? "9+" : n}</span>}
    </Link>
  );

  return (
    <VerifyGateProvider>
      <div className="min-h-dvh">
        <header className="safe-top sticky top-0 z-20 border-b border-stone-200/70 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
            <Link to="/dashboard" className="flex items-center">
              <BrandLogo size={32} nameClass="font-display text-[1.6rem] font-semibold leading-none text-brand-900" />
            </Link>
            <nav className="ml-4 hidden flex-1 gap-1 md:flex">
              {top("/dashboard", "Home", 0, true)}
              {top("/discover", "Discover")}
              {top("/matches", "Matches", pending)}
              {account?.role === "admin" && top("/admin", "Admin")}
            </nav>
            <div className="flex-1 md:hidden" />
            <Link to="/create" className="hidden items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 md:flex"><Icon name="plus" size={16} />Post</Link>
            <button onClick={toggle} aria-label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"} className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-stone-100 md:flex">
              <Icon name={resolved === "dark" ? "sun" : "moon"} size={21} />
            </button>
            {headerIcon("/create", "plus", "Create", 0)}
            {headerIcon("/notifications", "heart", "Notifications", bell)}
            {headerIcon("/messages", "chat", "Messages", unread)}
            <Link to={`/p/${user!.id}`} className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 md:flex"><Icon name="user" size={17} />Profile</Link>
            <Link to="/settings" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 md:flex"><Icon name="sliders" size={17} />Settings</Link>
            <button onClick={logout} className="hidden items-center gap-1.5 rounded-full border border-stone-300 px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 md:flex"><Icon name="logout" size={16} />Log out</button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl p-3 pb-28 md:p-5 md:pb-8">
          {unverified && !hideBanner && loc.pathname !== "/verify-face" && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl bg-brand-50 p-3 ring-1 ring-brand-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-600"><Icon name="shieldCheck" size={20} /></span>
              <p className="flex-1 text-sm text-stone-700"><b>You are browsing.</b> Verify your face to like, comment, send interests, chat and post.</p>
              <Link to="/verify-face" className="shrink-0 rounded-full bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white">Verify</Link>
              <button aria-label="Dismiss" className="shrink-0 text-stone-400" onClick={() => { sessionStorage.setItem("hide_verify_banner", "1"); setHideBanner(true); }}><Icon name="x" size={18} /></button>
            </div>
          )}
          <div key={loc.pathname} className="fade-up"><Outlet /></div>
        </main>

        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur md:hidden">
          <div className="grid grid-cols-5 items-end">
            {tab("/dashboard", "home", "Home")}
            {tab("/discover", "compass", "Discover")}
            <Link to="/create" aria-label="Create post" className="flex justify-center pb-2">
              <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg ring-4 ring-white"><Icon name="plus" size={28} strokeWidth={2.4} /></span>
            </Link>
            {tab("/matches", "heart", "Matches", pending)}
            {tab(`/p/${user!.id}`, "user", "Profile")}
          </div>
        </nav>
      </div>
    </VerifyGateProvider>
  );
}
