import { Link } from "react-router-dom";
import Icon from "./ui/Icon";

export default function MatchModal({ name, photo, chatTo, onClose }: { name: string; photo: string | null; chatTo: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/80 p-6" onClick={onClose}>
      <div className="fade-up w-full max-w-sm rounded-3xl bg-white p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          {photo ? <img src={photo} alt="" className="h-full w-full rounded-full object-cover" /> : <Icon name="heart" size={38} filled />}
        </span>
        <h2 className="mt-4 font-display text-3xl font-semibold text-brand-700">It's a Match!</h2>
        <p className="mt-1 text-sm text-stone-600">You and {name} are interested in each other.</p>
        <Link to={`/messages/${chatTo}`} className="mt-6 block rounded-xl bg-brand-600 py-3 font-semibold text-white">Start Chat</Link>
        <button onClick={onClose} className="mt-2 w-full py-2 text-sm text-stone-500">Keep browsing</button>
      </div>
    </div>
  );
}
