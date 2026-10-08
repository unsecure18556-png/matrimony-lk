import { Link } from "react-router-dom";
import type { StoryGroup } from "../../services/storyService";
import Icon from "../ui/Icon";

/** Instagram-style row: "Your Story" first, then only people who have an active story. */
export default function StoryTray({ groups, meId, myName, myPhoto, onOpen }: {
  groups: StoryGroup[]; meId: string; myName: string; myPhoto: string | null; onOpen: (index: number) => void;
}) {
  const mineIdx = groups.findIndex((g) => g.userId === meId);
  const mine = mineIdx >= 0 ? groups[mineIdx] : null;
  const ring = (unseen: boolean) => unseen
    ? "bg-gradient-to-tr from-amber-400 via-brand-500 to-brand-700 p-[2.5px]"
    : "bg-stone-300 p-[2px]";
  const avatar = (url: string | null, name: string) => url
    ? <img src={url} alt="" className="h-[62px] w-[62px] rounded-full border-[3px] border-cream object-cover" />
    : <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full border-[3px] border-cream bg-brand-100 font-display text-xl text-brand-600">{name[0]}</span>;

  return (
    <div className="flex gap-3.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="w-[72px] shrink-0 text-center">
        <div className="relative">
          {mine ? (
            <button onClick={() => onOpen(mineIdx)} className={`block rounded-full ${ring(true)}`} aria-label="View your story">{avatar(mine.photoUrl ?? myPhoto, myName)}</button>
          ) : (
            <Link to="/story/new" className="block rounded-full p-[2px]" aria-label="Add story">{avatar(myPhoto, myName)}</Link>
          )}
          <Link to="/story/new" aria-label="Add to your story" className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-cream"><Icon name="plus" size={14} strokeWidth={3} /></Link>
        </div>
        <span className="mt-1 block truncate text-xs">Your Story</span>
      </div>

      {groups.map((g, i) => g.userId === meId ? null : (
        <button key={g.userId} onClick={() => onOpen(i)} className="w-[72px] shrink-0 text-center" aria-label={`Story by ${g.name}`}>
          <span className="relative block">
            <span className={`block rounded-full ${ring(g.hasUnseen)}`}>{avatar(g.photoUrl, g.name)}</span>
            {g.rank < 2 && (
              <span title={g.rank === 0 ? "Matched" : "Interested"} className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-cream ${g.rank === 0 ? "bg-brand-600 text-white" : "bg-white text-brand-600"}`}>
                <Icon name="heart" size={11} filled={g.rank === 0} />
              </span>
            )}
          </span>
          <span className={`mt-1 block truncate text-xs ${g.hasUnseen ? "font-semibold" : "text-stone-500"}`}>{g.name.split(" ")[0]}</span>
        </button>
      ))}
    </div>
  );
}
