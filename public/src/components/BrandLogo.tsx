import { Logo } from "./ui/Icon";
import { useBranding } from "../branding/BrandingContext";
import { useTheme } from "../theme/ThemeContext";

/** Your logo (light/dark version) + app name. Falls back to the built-in rings mark. */
export default function BrandLogo({ size = 34, showName = true, variant, nameClass = "" }: {
  size?: number; showName?: boolean; variant?: "light" | "dark"; nameClass?: string;
}) {
  const { appName, showName: nameOn, logoFor } = useBranding();
  const { resolved } = useTheme();
  const url = logoFor(variant ?? resolved);
  return (
    <span className="inline-flex items-center gap-2.5">
      {url ? <img src={url} alt={appName} style={{ height: size, maxWidth: size * 4 }} className="w-auto object-contain" /> : <Logo size={size} />}
      {showName && nameOn && <span className={nameClass}>{appName}</span>}
    </span>
  );
}
