/** One tick = sent. Two blue ticks = seen (like WhatsApp). */
export default function Ticks({ seen }: { seen: boolean }) {
  return seen ? (
    <svg width="18" height="12" viewBox="0 0 18 12" fill="none" stroke="#7dd3fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Seen">
      <path d="M1 6.5l3.5 3.5L11 2.5" /><g transform="translate(5 0)"><path d="M1 6.5l3.5 3.5L11 2.5" /></g>
    </svg>
  ) : (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".75" role="img" aria-label="Sent">
      <path d="M1.5 6.5l3.5 3.5L12 2.5" />
    </svg>
  );
}
