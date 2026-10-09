import { Link } from "react-router-dom";
import { ageFromDob } from "../services/profileService";
import type { ProfileCard } from "../services/cardService";
import { matchLabel, type Scored } from "../services/matchService";
import Icon from "./ui/Icon";

interface Props {
  card: ProfileCard;
  sc?: Scored;
  note?: string;
  shortlisted?: boolean;
  onToggleShortlist?: () => void;
}

export default function ProfileCardView({ card, sc, note, shortlisted, onToggleShortlist }: Props) {
  const age = card.dob ? ageFromDob(card.dob) : null;
  const initials = card.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <article className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-900/5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative">
        <Link to={`/p/${card.id}`} className="relative block aspect-[3/4] overflow-hidden bg-gradient-to-br from-brand-100 to-gold-50">
          {card.photoUrl ? (
            <img src={card.photoUrl} alt={card.full_name} loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-brand-400">
              <span className="font-display text-5xl font-semibold">{initials || "?"}</span>
              {card.hasPhoto && (
                <span className="flex items-center gap-1 px-4 text-center text-xs"><Icon name="lock" size={13} />Shown after interest is accepted</span>
              )}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3 text-white">
            <p className="font-display text-lg font-semibold leading-tight drop-shadow">{card.full_name}{age ? `, ${age}` : ""}</p>
            <p className="flex items-center gap-1 text-xs text-white/85"><Icon name="mapPin" size={12} />{card.district ?? "Sri Lanka"}</p>
          </div>
        </Link>
        {card.face_verified && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
            <Icon name="check" size={11} strokeWidth={2.6} />Verified
          </span>
        )}
        {sc && (
          <span title={matchLabel(sc.score)} className="absolute right-2 top-2 rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-bold text-gold-700 shadow">
            {sc.score}% match
          </span>
        )}
        {onToggleShortlist && (
          <button onClick={onToggleShortlist} aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
            className={`absolute bottom-[4.2rem] right-2 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition active:scale-90 ${shortlisted ? "bg-brand-600 text-white" : "bg-white/95 text-brand-600"}`}>
            <Icon name="heart" size={18} filled={shortlisted} />
          </button>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <p className="flex items-center gap-1.5 truncate text-sm text-stone-700"><Icon name="briefcase" size={14} className="text-stone-400" />{card.occupation ?? "—"}</p>
        <p className="truncate text-xs text-stone-500">{[card.religion, card.ethnicity].filter(Boolean).join(" · ")}</p>
        {note && <p className="flex items-center gap-1 pt-0.5 text-xs font-medium text-brand-700"><Icon name="sparkles" size={13} />{note}</p>}
        {sc?.reasons[0] && <p className="text-xs text-stone-500">{sc.reasons[0]}</p>}
      </div>
    </article>
  );
}
