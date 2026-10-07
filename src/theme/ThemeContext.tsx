import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "system" | "light" | "dark";
interface ThemeState { theme: Theme; resolved: "light" | "dark"; setTheme: (t: Theme) => void; toggle: () => void }
const KEY = "theme";
const ThemeContext = createContext<ThemeState>({ theme: "system", resolved: "light", setTheme: () => {}, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

const prefersDark = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
const resolveTheme = (t: Theme): "light" | "dark" => (t === "system" ? (prefersDark() ? "dark" : "light") : t);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return (localStorage.getItem(KEY) as Theme) || "system"; } catch { return "system"; }
  });
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolveTheme(theme));

  useEffect(() => {
    const apply = () => {
      const r = resolveTheme(theme);
      setResolved(r);
      document.documentElement.dataset.theme = r;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", r === "dark" ? "#140c10" : "#B23A54");
    };
    apply();
    if (theme !== "system" || typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, [theme]);

  const setTheme = (t: Theme) => { try { localStorage.setItem(KEY, t); } catch { /* ignore */ } setThemeState(t); };
  const toggle = () => setTheme(resolved === "dark" ? "light" : "dark");
  return <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>{children}</ThemeContext.Provider>;
}
