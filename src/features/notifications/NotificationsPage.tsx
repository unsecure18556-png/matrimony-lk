import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listNotifications, markAllNotificationsRead, type Notif } from "../../services/notificationService";
import Icon, { type IconName } from "../../components/ui/Icon";
import { EmptyState, PageLoader } from "../../components/ui/Feedback";
import { timeAgo } from "../../utils/time";

const META: Record<Notif["type"], { icon: IconName; text: (n: string) => string; to: (x: Notif) => string }> = {
  interest: { icon: "heart", text: (n) => `${n} is interested in you`, to: () => "/matches?tab=interests" },
  interest_accepted: { icon: "check", text: (n) => `${n} accepted your interest`, to: (x) => `/p/${x.actor_id}` },
  interest_declined: { icon: "x", text: (n) => `${n} declined your interest`, to: () => "/matches?tab=interests" },
  match: { icon: "sparkles", text: (n) => `It's a match with ${n}!`, to: (x) => `/messages/${x.actor_id}` },
  like: { icon: "heart", text: (n) => `${n} liked your post`, to: (x) => `/post/${x.post_id}` },
  comment: { icon: "chat", text: (n) => `${n} commented on your post`, to: (x) => `/post/${x.post_id}` },
  message: { icon: "send", text: (n) => `${n} sent you a message`, to: (x) => `/messages/${x.actor_id}` },
};

export default function NotificationsPage() {
  const [list, setList] = useState<Notif[] | null>(null);

  useEffect(() => {
    listNotifications().then((l) => { setList(l); if (l.some((x) => !x.read_at)) markAllNotificationsRead(); });
  }, []);

  if (!list) return <PageLoader />;
  const day = 864e5;
  const fresh = list.filter((n) => Date.now() - new Date(n.created_at).getTime() < day);
  const older = list.filter((n) => Date.now() - new Date(n.created_at).getTime() >= day);

  const row = (n: Notif) => {
    const m = META[n.type];
    const name = n.actor?.full_name ?? "A member";
    return (
      <Link key={n.id} to={m.to(n)} className={`flex items-center gap-3 border-b border-stone-100 px-4 py-3.5 last:border-0 active:bg-stone-100 ${n.read_at ? "" : "bg-brand-50/70"}`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600"><Icon name={m.icon} size={20} filled={n.type === "interest" || n.type === "like"} /></span>
        <span className="min-w-0 flex-1 text-sm">{m.text(name)}<span className="block text-xs text-stone-400">{timeAgo(n.created_at)}</span></span>
        {!n.read_at && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-display text-2xl font-semibold">Notifications</h1>
      {list.length === 0 && <EmptyState icon="bell" title="No notifications yet" text="Interests, matches, likes, comments and messages show up here." />}
      {fresh.length > 0 && <section><h2 className="mb-1.5 px-1 font-sans text-xs font-semibold uppercase tracking-wide text-stone-500">New</h2><div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5">{fresh.map(row)}</div></section>}
      {older.length > 0 && <section><h2 className="mb-1.5 px-1 font-sans text-xs font-semibold uppercase tracking-wide text-stone-500">Earlier</h2><div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5">{older.map(row)}</div></section>}
    </div>
  );
}
