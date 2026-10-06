import { useRef, useState } from "react";
import { useBranding } from "../../branding/BrandingContext";
import { addAllowedDomain, listAllowedDomains, removeAllowedDomain, removeLogo, saveBrand, uploadLogo } from "../../services/brandingService";
import { btnSmall, btnSmallOutline, input, panel } from "../../components/ui/styles";
import Icon from "../../components/ui/Icon";
import Toggle from "../../components/ui/Toggle";
import { useEffect } from "react";

export default function BrandingAdmin() {
  const b = useBranding();
  const [name, setName] = useState(b.appName);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const lightRef = useRef<HTMLInputElement>(null);
  const darkRef = useRef<HTMLInputElement>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");

  useEffect(() => { setName(b.appName); }, [b.appName]);
  useEffect(() => { listAllowedDomains().then(setDomains); }, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(""); setMsg("");
    try { await fn(); await b.refresh(); setMsg(ok); } catch (e: any) { setErr(e.message); }
  };

  const logoBox = (kind: "light" | "dark", url: string | null, path: string | null, ref: React.RefObject<HTMLInputElement | null>) => (
    <div className="space-y-2">
      <p className="text-sm font-medium">{kind === "light" ? "Logo for light theme" : "Logo for dark theme"}</p>
      <div className={`flex h-24 items-center justify-center rounded-xl ring-1 ring-stone-300 ${kind === "dark" ? "bg-[#140c10]" : "bg-white"}`}>
        {url ? <img src={url} alt="" className="max-h-20 max-w-[80%] object-contain" /> : <span className="text-xs text-stone-400">Default mark</span>}
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) run(() => uploadLogo(kind, f, path), "Logo updated"); e.target.value = ""; }} />
      <div className="flex gap-2">
        <button className={btnSmall} onClick={() => ref.current?.click()}><Icon name="image" size={16} />Upload</button>
        {path && <button className={btnSmallOutline} onClick={() => run(() => removeLogo(kind, path), "Logo removed")}>Remove</button>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className={`${panel} space-y-4`}>
        <h2 className="font-display text-xl font-semibold">Branding</h2>
        {msg && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{msg}</p>}
        {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <div className="flex gap-2">
          <input className={input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="App name" />
          <button className={btnSmall} onClick={() => run(() => saveBrand({ app_name: name.trim() }), "App name updated")}>Save</button>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Show the app name next to the logo</span>
          <Toggle label="Show name" checked={b.showName} onChange={(v) => run(() => saveBrand({ show_name: v }), "Updated")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {logoBox("light", b.logoLight, b.paths.light, lightRef)}
          {logoBox("dark", b.logoDark, b.paths.dark, darkRef)}
        </div>
        <p className="text-xs text-stone-500">PNG, JPG, WebP or SVG up to 2 MB. A transparent PNG or SVG works best. If you only upload one logo, it is used for both themes.</p>
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className="font-display text-xl font-semibold">Verified link websites</h2>
        <p className="text-sm text-stone-500">Members can only share links from these websites in chat. Subdomains are included.</p>
        <div className="flex flex-wrap gap-2">
          {domains.map((d) => (
            <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">
              {d}
              <button aria-label={`Remove ${d}`} onClick={() => run(async () => { await removeAllowedDomain(d); setDomains(await listAllowedDomains()); }, "Removed")}><Icon name="x" size={13} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input className={input} placeholder="example.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
          <button className={btnSmall} onClick={() => run(async () => { await addAllowedDomain(newDomain); setNewDomain(""); setDomains(await listAllowedDomains()); }, "Added")}>Add</button>
        </div>
      </section>
    </div>
  );
}
