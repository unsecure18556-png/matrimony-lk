import { Component, type ReactNode } from "react";

const box = "mx-auto mt-16 max-w-xl rounded-2xl bg-white p-6 shadow ring-1 ring-black/10";

export function SetupScreen({ problem }: { problem: string }) {
  return (
    <div className="p-4">
      <div className={box}>
        <h1 className="text-2xl font-semibold text-brand-900">Setup needed</h1>
        <p className="mt-2 text-red-700">{problem}</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-stone-700">
          <li>In Supabase open <b>Project Settings → API</b> and copy the <b>Project URL</b> and the <b>publishable (anon) key</b>.</li>
          <li>Stop the server (Ctrl+C) and run this in the terminal, with your two values:</li>
        </ol>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-900 p-3 text-xs text-green-300">{`printf "VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co\\nVITE_SUPABASE_ANON_KEY=YOUR-KEY\\n" > .env`}</pre>
        <p className="mt-3 text-sm text-stone-700">Then run <code className="rounded bg-stone-100 px-1">npm run dev</code> again and refresh.</p>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-4">
        <div className={box}>
          <h1 className="text-2xl font-semibold text-brand-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-stone-600">Send this message to your developer or helper:</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-stone-900 p-3 text-xs text-red-300">{String(this.state.error.stack || this.state.error.message)}</pre>
          <button onClick={() => location.reload()} className="mt-4 rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white">Reload</button>
        </div>
      </div>
    );
  }
}
