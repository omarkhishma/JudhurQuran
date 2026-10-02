"use client";

import { useId, useState } from "react";
import { setLocalStorage, useLocalStorage } from "@/lib/client";

const KEY = "judhur-panel-layers";

function readLayers(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

/** A collapsible layer of the panel; open/closed persists per section (handoff §3.5). */
export function PanelSection({
  id,
  title,
  defaultOpen,
  forceOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen: boolean;
  forceOpen?: boolean;
  children: React.ReactNode;
}) {
  const raw = useLocalStorage(KEY);
  const [override, setOverride] = useState<boolean | null>(null);
  const bodyId = useId();
  let stored: boolean | undefined;
  try {
    stored = raw ? (JSON.parse(raw) as Record<string, boolean>)[id] : undefined;
  } catch {
    stored = undefined;
  }
  const open = override ?? (forceOpen ? true : (stored ?? defaultOpen));
  function toggle() {
    const next = !open;
    setOverride(next);
    setLocalStorage(KEY, JSON.stringify({ ...readLayers(), [id]: next }));
  }
  return (
    <section className="border-b border-line">
      <h3>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-[48px] w-full items-center justify-between px-5 text-start text-[14.5px] font-semibold text-t1 hover:bg-card-2"
        >
          {title}
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={"transition-transform " + (open ? "rotate-180" : "")}>
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </h3>
      {open && (
        <div id={bodyId} className="px-5 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}
