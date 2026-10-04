import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

export function PageLoader({ text = "Loading" }: { text?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-stone-500">
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-600" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

export function CardSkeletons({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5">
          <div className="aspect-[3/4] animate-pulse bg-brand-100/60" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-2/3 animate-pulse rounded bg-stone-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand-200 bg-white/60 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {text && <p className="max-w-sm text-sm text-stone-500">{text}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
