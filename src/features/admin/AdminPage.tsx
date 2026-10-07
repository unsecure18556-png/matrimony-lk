import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { btnSmall, btnSmallOutline, panel } from "../../components/ui/styles";
import BrandingAdmin from "./BrandingAdmin";

interface Report { post_id: string | null; id: string; reporter: string; reported: string; reason: string; details: string | null; status: string; created_at: string }

export default function AdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [flags, setFlags] = useState(0);
  const [postCaps, setPostCaps] = useState<Map<string, string>>(new Map());
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("reports").select("*").eq("status", "open").order("created_at");
    const rs = (data ?? []) as Report[];
    setReports(rs);
    const ids = [...new Set(rs.flatMap((r) => [r.reporter, r.reported]))];
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      setNames(new Map((ps ?? []).map((p) => [p.id, p.full_name])));
    }
    const pids = rs.map((r) => r.post_id).filter(Boolean) as string[];
    if (pids.length) {
      const { data: ps } = await supabase.from("posts").select("id,caption").in("id", pids);
      setPostCaps(new Map((ps ?? []).map((x) => [x.id, x.caption ?? "(photo only)"])));
    }
    const { count } = await supabase.from("face_flags").select("id", { count: "exact", head: true });
    setFlags(count ?? 0);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function resolve(id: string, status: string, ban: boolean) {
    setErr("");
    const { error } = await supabase.rpc("admin_resolve_report", { p_id: id, p_status: status, p_ban: ban });
    if (error) setErr(error.message); else load();
  }

  return (
    <div className="space-y-4">
      <BrandingAdmin />
      <h1 className="font-display text-2xl font-semibold">Moderation</h1>
      <p className="text-sm text-gray-500">Duplicate-face flags recorded: {flags} (table <code>face_flags</code> in Supabase).</p>
      {err && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{err}</p>}
      {reports.length === 0 && <p className="text-gray-500">No open reports</p>}
      {reports.map((r) => (
        <div key={r.id} className={`${panel} space-y-2`}>
          <p className="text-sm">
            <b>{names.get(r.reporter) ?? "?"}</b> reported{" "}
            <Link className="font-semibold text-brand-700 underline" to={`/p/${r.reported}`}>{names.get(r.reported) ?? "profile"}</Link>
          </p>
          <p className="text-sm"><b>{r.reason}</b>{r.details ? `: ${r.details}` : ""}</p>
          {r.post_id && <p className="rounded-lg bg-stone-50 p-2 text-sm">Post: {postCaps.get(r.post_id) ?? "(deleted)"} <Link className="ml-2 text-brand-700 underline" to={`/post/${r.post_id}`}>open</Link>{postCaps.has(r.post_id) && <button className="ml-3 text-red-600 underline" onClick={async () => { if (confirm("Delete this post?")) { await supabase.from("posts").delete().eq("id", r.post_id!); load(); } }}>delete post</button>}</p>}
          <div className="flex gap-2">
            <button className={btnSmallOutline} onClick={() => resolve(r.id, "dismissed", false)}>Dismiss</button>
            <button className={btnSmallOutline} onClick={() => resolve(r.id, "resolved", false)}>Resolve</button>
            <button className={btnSmall} onClick={() => confirm("Ban this user?") && resolve(r.id, "resolved", true)}>Resolve + ban</button>
          </div>
        </div>
      ))}
    </div>
  );
}
