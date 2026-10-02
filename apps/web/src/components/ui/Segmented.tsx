"use client";

/** Segmented control (design 02 §2.5 seg recipe). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg-group" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="seg" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
