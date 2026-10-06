import type { ReactNode } from "react";
import Icon from "./Icon";
import BrandLogo from "../BrandLogo";

export default function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <svg className="pointer-events-none absolute -right-16 bottom-10 opacity-[.12]" width="460" height="460" viewBox="0 0 100 100" fill="none" stroke="#F7C6D0" strokeWidth=".6">
          <circle cx="38" cy="50" r="30" /><circle cx="62" cy="50" r="30" /><circle cx="38" cy="50" r="22" /><circle cx="62" cy="50" r="22" />
        </svg>
        <div className="relative">
          <BrandLogo size={42} variant="dark" nameClass="font-display text-xl font-semibold text-white" />
        </div>
        <div className="relative max-w-md space-y-8">
          <h2 className="font-display text-5xl font-semibold leading-[1.1]">
            A partner for life, <span className="text-gold-300">found with trust.</span>
          </h2>
          <ul className="space-y-4 text-brand-100">
            {([
              ["shieldCheck", "Every member is face-verified", "Real people only. No fake profiles."],
              ["lock", "Your photos, your control", "Share photos only with people you accept."],
              ["sparkles", "Smart matching", "Matches ranked by what matters to you and your family."],
            ] as const).map(([icon, t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-gold-300">
                  <Icon name={icon} size={18} />
                </span>
                <span><b className="block font-semibold text-white">{t}</b><span className="text-sm">{d}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-200">Made for Sri Lankan families.</p>
      </aside>

      <main className="flex items-center justify-center p-4 sm:p-8">
        <div className="fade-up w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <BrandLogo size={36} nameClass="font-display text-lg font-semibold text-brand-900" />
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-xl shadow-brand-900/5 ring-1 ring-stone-900/5 sm:p-8">
            <h1 className="font-display text-3xl font-semibold text-brand-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-5 text-center text-sm text-stone-600">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
