"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog (design 02 §2.5 popover recipe): scrim, role="dialog", labelled, focus moved in and
 * trapped, Esc and the scrim close, focus returns to the opener. Every overlay in the product uses it
 * (the prototype had none of this — RDR-461).
 */
export function Dialog({
  open,
  onClose,
  label,
  children,
  width = 460,
  align = "center",
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  width?: number;
  /** "bottom": a sheet risen from the foot of the screen (the hub's sign-in, HUB-29) */
  align?: "center" | "top" | "bottom";
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>("[data-autofocus]") ?? box.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !box.current) return;
      const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
      if (!items.length) return;
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className={"fixed inset-0 z-[95] flex justify-center bg-[rgba(10,10,16,.4)] p-3 animate-fade " + (align === "top" ? "items-start pt-[70px]" : align === "bottom" ? "items-end sm:p-7" : "items-center")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-describedby={titleId}
        className={"popover flex max-h-full w-full flex-col overflow-y-auto " + className}
        style={{ maxWidth: width }}
      >
        <span id={titleId} className="sr-only">
          {label}
        </span>
        {children}
      </div>
    </div>,
    document.body,
  );
}
