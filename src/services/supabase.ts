import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Why the setup is wrong, or null when everything looks fine */
export const envProblem: string | null = !url || !key
  ? "The .env file is missing or empty."
  : !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url.trim())
    ? "VITE_SUPABASE_URL must look like https://abcdxyz.supabase.co with nothing after .co (no slash, no extra path)."
    : null;

// A placeholder keeps the app from crashing on import so we can show a helpful screen instead
export const supabase = createClient(
  url?.trim() || "https://placeholder.supabase.co",
  key?.trim() || "placeholder-key"
);
