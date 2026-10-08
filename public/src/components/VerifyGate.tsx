import { createContext, useContext, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import Icon from "./ui/Icon";

const Ctx = createContext<{ requireFace: (action: string) => boolean }>({ requireFace: () => true });
/** requireFace("like posts") returns true when allowed; otherwise shows the "verify your face" prompt and returns false. */
export const useVerifyGate = () => useContext(Ctx);

export function VerifyGateProvider({ children }: { children: ReactNode }) {
  const { profile, account } = useAuth();
  const nav = useNavigate();
  const [action, setAction] = useState<string | null>(null);
  const ok = !profile || profile.face_verified || account?.role === "admin";
  const requireFace = (a: string) => { if (ok) return true; setAction(a); return false; };

  return (
    <Ctx.Provider value={{ requireFace }}>
      {children}
      {action && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setAction(null)}>
          <div className="fade-up w-full max-w-sm rounded-t-3xl bg-white p-6 text-center sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Icon name="shieldCheck" size={32} /></span>
            <h2 className="mt-3 font-display text-2xl font-semibold">Verify your face</h2>
            <p className="mt-1 text-sm text-stone-600">To {action}, we first need to confirm you are a real person. It takes about a minute and keeps the community safe.</p>
            <button className="mt-5 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white" onClick={() => { setAction(null); nav("/verify-face"); }}>Verify now</button>
            <button className="mt-2 w-full py-2 text-sm text-stone-500" onClick={() => setAction(null)}>Not now</button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
