"use client";

import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "./useFocusTrap";

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

  useFocusTrap(box, open, onClose);

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
