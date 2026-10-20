import { useEffect, useRef, type RefObject } from "react";

// Menus, selects and dialogs that Radix portals to <body> belong to whatever opened them
const PORTALED = '[data-radix-popper-content-wrapper], [role="dialog"], [role="listbox"], [role="menu"]';

/** Calls onAway when a press lands outside the given element while enabled. */
export function useClickAway(ref: RefObject<HTMLElement | null>, onAway: () => void, enabled = true) {
  const awayRef = useRef(onAway);
  awayRef.current = onAway;

  useEffect(() => {
    if (!enabled) return;
    const handle = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.isConnected || ref.current?.contains(target)) return;
      if (target.closest(PORTALED)) return;
      awayRef.current();
    };
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [ref, enabled]);
}

/** Backdrop handler for a full-screen modal: closes only when the press starts on the backdrop itself. */
export const closeOnBackdrop = (onClose: () => void) => (e: React.MouseEvent) => {
  if (e.target === e.currentTarget) onClose();
};
