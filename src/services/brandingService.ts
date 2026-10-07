import { supabase } from "./supabase";

export interface BrandSettings {
  app_name: string; logo_light: string | null; logo_dark: string | null; show_name: boolean; updated_at: string;
}

export async function fetchBrand(): Promise<BrandSettings | null> {
  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  return (data as BrandSettings) ?? null;
}

export const publicLogoUrl = (path: string, version: string) =>
  `${supabase.storage.from("branding").getPublicUrl(path).data.publicUrl}?v=${encodeURIComponent(version)}`;

export async function saveBrand(patch: Partial<Pick<BrandSettings, "app_name" | "logo_light" | "logo_dark" | "show_name">>) {
  const { error } = await supabase.from("app_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) throw error;
}

export async function uploadLogo(kind: "light" | "dark", file: File, oldPath: string | null) {
  const ext = (file.type.split("/")[1] || "png").replace("svg+xml", "svg");
  const path = `logo-${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("branding").upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  await saveBrand(kind === "light" ? { logo_light: path } : { logo_dark: path });
  if (oldPath) await supabase.storage.from("branding").remove([oldPath]);
}

export async function removeLogo(kind: "light" | "dark", oldPath: string | null) {
  await saveBrand(kind === "light" ? { logo_light: null } : { logo_dark: null });
  if (oldPath) await supabase.storage.from("branding").remove([oldPath]);
}

// ----- verified link domains -----
export async function listAllowedDomains(): Promise<string[]> {
  const { data } = await supabase.from("allowed_domains").select("domain").order("domain");
  return (data ?? []).map((r) => r.domain);
}
export async function addAllowedDomain(domain: string) {
  const d = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (!d || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) throw new Error("Enter a domain like example.com");
  const { error } = await supabase.from("allowed_domains").insert({ domain: d });
  if (error) throw error;
}
export async function removeAllowedDomain(domain: string) {
  const { error } = await supabase.from("allowed_domains").delete().eq("domain", domain);
  if (error) throw error;
}
