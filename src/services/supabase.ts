import { createClient } from "@supabase/supabase-js";

// Settings come from /config.js (hosted site) or from .env (local development)
const cfg = ((window as unknown as { APP_CONFIG?: { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string } }).APP_CONFIG) ?? {};
const url = (cfg.SUPABASE_URL || (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "").trim();
const key = (cfg.SUPABASE_ANON_KEY || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "").trim();

/** Why the setup is wrong, or null when everything looks fine */
export const envProblem: string | null = !url || !key
  ? "The Supabase settings are missing."
  : !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)
    ? "The Supabase URL must look like https://abcdxyz.supabase.co with nothing after .co (no slash, no extra path)."
    : null;

// A placeholder keeps the app from crashing on import so we can show a helpful screen instead
export const supabase = createClient(url || "https://placeholder.supabase.co", key || "placeholder-key");
