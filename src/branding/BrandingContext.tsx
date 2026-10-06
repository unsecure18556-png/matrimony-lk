import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchBrand, publicLogoUrl, type BrandSettings } from "../services/brandingService";

interface Brand { appName: string; showName: boolean; logoLight: string | null; logoDark: string | null; paths: { light: string | null; dark: string | null } }
interface BrandState extends Brand {
  logoFor: (theme: "light" | "dark") => string | null;
  refresh: () => Promise<void>;
}
const DEFAULT: Brand = { appName: "Matrimony LK", showName: true, logoLight: null, logoDark: null, paths: { light: null, dark: null } };
const CACHE = "brand_v1";
const BrandingContext = createContext<BrandState>({ ...DEFAULT, logoFor: () => null, refresh: async () => {} });
export const useBranding = () => useContext(BrandingContext);

function toBrand(s: BrandSettings): Brand {
  return {
    appName: s.app_name, showName: s.show_name,
    logoLight: s.logo_light ? publicLogoUrl(s.logo_light, s.updated_at) : null,
    logoDark: s.logo_dark ? publicLogoUrl(s.logo_dark, s.updated_at) : null,
    paths: { light: s.logo_light, dark: s.logo_dark },
  };
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<Brand>(() => {
    try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(CACHE) ?? "{}") }; } catch { return DEFAULT; }
  });

  const refresh = useCallback(async () => {
    try {
      const s = await fetchBrand();
      if (!s) return;
      const b = toBrand(s);
      setBrand(b);
      try { localStorage.setItem(CACHE, JSON.stringify(b)); } catch { /* ignore */ }
    } catch { /* offline or not set up yet: keep defaults */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { document.title = brand.appName; }, [brand.appName]);

  const logoFor = (t: "light" | "dark") => (t === "dark" ? brand.logoDark ?? brand.logoLight : brand.logoLight ?? brand.logoDark);
  return <BrandingContext.Provider value={{ ...brand, logoFor, refresh }}>{children}</BrandingContext.Provider>;
}
