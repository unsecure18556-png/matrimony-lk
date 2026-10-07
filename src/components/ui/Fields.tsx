import type { ReactNode } from "react";
import { input } from "./styles";

function Wrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

export function SelectField(props: {
  label: string; value: string | null | undefined;
  onChange: (v: string) => void; options: string[];
}) {
  return (
    <Wrap label={props.label}>
      <select className={input} value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)}>
        <option value="">Select...</option>
        {props.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Wrap>
  );
}

export function TextField(props: {
  label: string; value: string | number | null | undefined;
  onChange: (v: string) => void; type?: string; placeholder?: string;
  min?: number; max?: number;
}) {
  return (
    <Wrap label={props.label}>
      <input
        className={input} type={props.type ?? "text"} placeholder={props.placeholder}
        min={props.min} max={props.max}
        value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)}
      />
    </Wrap>
  );
}

export function TextArea(props: {
  label: string; value: string | null | undefined;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <Wrap label={props.label}>
      <textarea
        className={input} rows={5} placeholder={props.placeholder}
        value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)}
      />
    </Wrap>
  );
}
