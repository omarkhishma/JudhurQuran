"use client";

import { useEffect, useRef } from "react";

export type MenuItem = { label: string; keys?: string; danger?: boolean; disabled?: boolean; run: () => void };

/**
 * A context menu on the canvas (EDT-065, EDT-069, HWF-37): kept inside the pane, a menu with its items and their
 * keys; any key but the arrows and Enter closes it, as does a click outside or Escape, and focus returns to where
 * it was. Arrow keys move between the items.
 */
export function CanvasMenu({ x, y, bounds, items, label, onClose }: { x: number; y: number; bounds: { width: number; height: number }; items: MenuItem[]; label: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const back = useRef<Element | null>(null);
  useEffect(() => {
    back.current = document.activeElement;
    box.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", close, true);
    const restore = back;
    return () => {
      window.removeEventListener("mousedown", close, true);
      (restore.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);
  const left = Math.max(6, Math.min(x, bounds.width - 214));
  const top = Math.max(6, Math.min(y, bounds.height - 40 - items.length * 36));
  return (
    <div
      ref={box}
      role="menu"
      aria-label={label}
      className="canvas-menu"
      style={{ left, top }}
      onKeyDown={(e) => {
        const buttons = [...(box.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])];
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          buttons[(i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        } else if (e.key === "Escape" || (e.key !== "Enter" && e.key !== " " && e.key !== "Tab" && e.key !== "Shift")) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          disabled={it.disabled}
          className={"canvas-menu-item" + (it.danger ? " is-danger" : "")}
          onClick={() => {
            onClose();
            it.run();
          }}
        >
          <span className="min-w-0 flex-1 truncate">{it.label}</span>
          {it.keys && (
            <kbd className="mono text-[11px] text-t3" dir="ltr">
              {it.keys}
            </kbd>
          )}
        </button>
      ))}
    </div>
  );
}
