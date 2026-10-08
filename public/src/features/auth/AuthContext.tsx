import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../../services/supabase";
import type { Profile } from "../../services/profileService";

export interface Account {
  id: string;
  role: "user" | "moderator" | "admin";
  plan: "free" | "premium";
  face_verified: boolean;
  banned: boolean;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  account: Account | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null, user: null, account: null, profile: null, loading: true,
  refreshProfile: async () => {},
});
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setAccount(null); setProfile(null); setLoading(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;

  const refreshProfile = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    setProfile((data as Profile) ?? null);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    Promise.all([
      supabase.from("accounts").select("*").eq("id", uid).single(),
      supabase.from("profiles").select("*").eq("id", uid).single(),
    ]).then(([a, p]) => {
      setAccount((a.data as Account) ?? null);
      setProfile((p.data as Profile) ?? null);
      setLoading(false);
    });
  }, [uid]);

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, account, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
