import { Link } from "react-router-dom";
import type { StoryGroup } from "../../services/storyService";
import type { ProfileCard } from "../../services/cardService";
import Icon from "../ui/Icon";

export default function StoryTray({ groups, meId, myName, people, onOpen }: {
  groups: StoryGroup[]; meId: string; myName: string; people: ProfileCard[]; onOpen: (index: number) => void;
}) {
  const mineIdx = groups.findIndex((g) => g.userId === meId);
  const mine = mineIdx >= 0 ? groups[mineIdx] : null;
  const ring = (unseen: boolean) => unseen ? "bg-gradient-to-tr from-brand-600 via-brand-500 to-brand-200 p-[2.5px]" : "bg-stone-300 p-[2px]";
  const avatar = (url: string | null, name: string) => url
    ? <img src={url} alt="" className="h-16 w-16 rounded-full border-[3px] border-cream object-cover" />
    : <span className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-cream bg-brand-100 font-display text-xl text-brand-600">{name[0]}</span>;
  const storyPeople = new Set(groups.map((g) => g.userId));

  return (
    <div className="flex gap-4 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="w-[68px] shrink-0 text-center">
        <div className="relative">
          {mine ? (
            <button onClick={() => onOpen(mineIdx)} className={`block rounded-full ${ring(true)}`} aria-label="View your story">{avatar(mine.photoUrl, myName)}</button>
          ) : (
            <Link to="/story/new" className="block rounded-full bg-brand-100 p-[2px]" aria-label="Add story"><span className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-cream bg-brand-100 font-display text-xl text-brand-600">{myName[0]}</span></Link>
          )}
          <Link to="/story/new" aria-label="Add to your story" className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-cream"><Icon name="plus" size={14} strokeWidth={3} /></Link>
        </div>
        <span className="mt-1 block text-xs">Your story</span>
      </div>

      {groups.map((g, i) => g.userId === meId ? null : (
        <button key={g.userId} onClick={() => onOpen(i)} className="w-[68px] shrink-0 text-center" aria-label={`Story by ${g.name}`}>
          <span className={`block rounded-full ${ring(g.hasUnseen)}`}>{avatar(g.photoUrl, g.name)}</span>
          <span className={`mt-1 block truncate text-xs ${g.hasUnseen ? "font-semibold" : "text-stone-500"}`}>{g.name.split(" ")[0]}</span>
        </button>
      ))}

      {people.filter((p) => !storyPeople.has(p.id)).map((c) => (
        <Link key={c.id} to={`/p/${c.id}`} className="w-[68px] shrink-0 text-center">
          <span className="block rounded-full bg-stone-200 p-[2px]">{avatar(c.photoUrl, c.full_name)}</span>
          <span className="mt-1 block truncate text-xs text-stone-500">{c.full_name.split(" ")[0]}</span>
        </Link>
      ))}
    </div>
  );
}
