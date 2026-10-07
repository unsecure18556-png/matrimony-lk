import { useState } from "react";
import Icon from "./ui/Icon";
import { input } from "./ui/styles";
import { REPORT_REASONS } from "../utils/constants";

export default function ReportSheet({ title, onClose, onSubmit }: {
  title: string; onClose: () => void; onSubmit: (reason: string, details: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button aria-label="Close" onClick={onClose}><Icon name="x" size={22} /></button>
        </div>
        <div className="divide-y divide-stone-100 rounded-xl ring-1 ring-stone-200">
          {REPORT_REASONS.map((r) => (
            <button key={r} onClick={() => setReason(r)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm">
              {r}
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${reason === r ? "border-brand-600 bg-brand-600 text-white" : "border-stone-300"}`}>
                {reason === r && <Icon name="check" size={12} strokeWidth={3} />}
              </span>
            </button>
          ))}
        </div>
        <textarea className={input} rows={2} placeholder="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-50"
          onClick={async () => { setBusy(true); setErr(""); try { await onSubmit(reason, details); } catch (e: any) { setErr(e.message); setBusy(false); } }}>
          Submit report
        </button>
      </div>
    </div>
  );
}
