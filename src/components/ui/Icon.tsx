import type { SVGProps } from "react";

const PATHS = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  search: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>),
  sparkles: (<><path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z" /><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z" /></>),
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z" />,
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>),
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>),
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
  shield: <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />,
  shieldCheck: (<><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>),
  sliders: (<><path d="M4 7h9M19 7h1M4 17h1M11 17h9" /><circle cx="16" cy="7" r="2.2" /><circle cx="8" cy="17" r="2.2" /></>),
  lock: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  camera: (<><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></>),
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronUp: <path d="M6 15l6-6 6 6" />,
  logout: <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z" />,
  smile: (<><circle cx="12" cy="12" r="9" /><path d="M8.5 14c1 1.3 2.1 2 3.5 2s2.5-.7 3.5-2" /><path d="M9 10h.01M15 10h.01" /></>),
  rings: (<><circle cx="8.5" cy="15" r="5" /><circle cx="15.5" cy="15" r="5" /><path d="M12 2.5l1.8 2.2L12 6.9 10.2 4.7z" /></>),
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  alert: (<><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18h.01" /></>),
  mapPin: (<><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
  briefcase: (<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  users: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .7 3.5 2.6 3.5 5.7" /></>),
  camOff: (<><path d="M3 3l18 18" /><path d="M9 5h6.5L17 8h3a1 1 0 0 1 1 1v8M5 8H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h13" /></>),
  dots: (<><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>),
  grid: (<><rect x="3.5" y="3.5" width="7" height="7" /><rect x="13.5" y="3.5" width="7" height="7" /><rect x="3.5" y="13.5" width="7" height="7" /><rect x="13.5" y="13.5" width="7" height="7" /></>),
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>),
  key: (<><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></>),
  eye: (<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  ban: (<><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>),
  help: (<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></>),
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  image: (<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 9" /></>),
  hash: <path d="M5 9h15M4 15h15M10 3L8 21M16 3l-2 18" />,
  bookmark: <path d="M6 4h12v17l-6-4-6 4z" />,
  share: <path d="M7 17L17 7M8 7h9v9" />,
  bell: (<><path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15z" /><path d="M10 21h4" /></>),
  compass: (<><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>),
  eyeOff: (<><path d="M3 3l18 18" /><path d="M10.6 6.1A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.3 3.8M6.5 7.6A17 17 0 0 0 2 12s3.6 6 10 6a9 9 0 0 0 3.4-.7" /></>),
} as const;

export type IconName = keyof typeof PATHS;

interface Props extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  filled?: boolean;
}

export default function Icon({ name, size = 20, filled = false, className = "", ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className}`} aria-hidden="true" {...rest}>
      {PATHS[name]}
    </svg>
  );
}

/** Brand mark: two rings on a crimson tile */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-gold-200 shadow-sm"
      style={{ width: size, height: size }}>
      <Icon name="rings" size={size * 0.62} />
    </span>
  );
}
