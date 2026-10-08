import { supabase } from "./supabase";

export type CreatingFor = "self" | "son" | "daughter" | "brother" | "sister" | "friend";

export async function registerWithEmail(
  name: string,
  email: string,
  password: string,
  creatingFor: CreatingFor
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name, creating_for: creatingFor },
      emailRedirectTo: `${window.location.origin}/dashboard`,
    },
  });
  if (error) throw error;
  if (data.user && data.user.identities?.length === 0) {
    throw new Error("This email is already registered. Please log in.");
  }
  return data;
}

export async function loginWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export const loginWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/dashboard` },
  });

export const resetPassword = (email: string) =>
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export const resendVerification = (email: string) =>
  supabase.auth.resend({ type: "signup", email });

export const logout = () => supabase.auth.signOut();

