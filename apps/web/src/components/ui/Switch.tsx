"use client";

/** Toggle row (design 02 §2.5): the whole row is a role="switch" button — track, label, one-line hint. */
export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="switch-row">
      <span className="switch-track" data-on={checked} aria-hidden="true">
        <span className="switch-knob" />
      </span>
      <span className="flex min-w-0 flex-col items-start text-start">
        <span className="text-[13px] text-t1">{label}</span>
        {hint && <span className="text-[11.5px] leading-[1.35] text-t3">{hint}</span>}
      </span>
    </button>
  );
}
