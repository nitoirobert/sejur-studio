"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/*
  A native modal <dialog>: focus trap, Esc and the top layer come from the browser.
  Phone (< 768 px): a bottom sheet. Wider: a glass panel on the right, full height.
  Focus goes back to whatever opened it (a bar, a cell, a button).
  While `busy` (a save in flight) it does not close: Esc, the backdrop and the X are ignored.
*/
export function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  testId,
  busy = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  title: string;
  closeLabel: string;
  testId: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const openRef = useRef(open);
  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
    openRef.current = open;
  }, [onClose, busy, open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const cancel = (e: Event) => {
      if (busyRef.current) e.preventDefault();
    };
    const handle = () => {
      // Chrome may force a repeated Esc through cancel: reopen, the save decides.
      // Only while the parent still wants it open; after a save it closes for good.
      if (busyRef.current && openRef.current) {
        dialog.showModal();
        return;
      }
      onCloseRef.current();
      const back = opener.current;
      opener.current = null;
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
    dialog.addEventListener("cancel", cancel);
    dialog.addEventListener("close", handle);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.removeEventListener("close", handle);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      data-testid={testId}
      data-busy={busy ? "" : undefined}
      aria-label={title}
      aria-busy={busy || undefined}
      // A click on the backdrop lands on the <dialog> itself.
      onClick={(e) => e.target === e.currentTarget && !busy && e.currentTarget.close()}
      className="sheet fixed inset-x-0 top-auto bottom-0 m-0 max-h-[90dvh] w-full max-w-none overflow-hidden rounded-t-[1.75rem] border border-glass-line bg-glass-strong p-0 text-ink shadow-glass backdrop-blur-2xl backdrop-saturate-150 backdrop:bg-[rgb(13_22_38/0.32)] backdrop:backdrop-blur-[2px] md:inset-y-3 md:right-3 md:left-auto md:h-[calc(100dvh-1.5rem)] md:max-h-none md:w-[25rem] md:rounded-card"
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col md:h-full md:max-h-none">
          <div className="flex items-center gap-3 px-5 pt-3 pb-2 md:px-6 md:pt-5">
            <span aria-hidden className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-sand-200 md:hidden" />
            <h2 className="mt-2 font-serif text-2xl leading-tight text-ink">{title}</h2>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              disabled={busy}
              aria-label={closeLabel}
              title={closeLabel}
              className="mt-2 ml-auto grid size-11 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-cream-50/70 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-6">
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}
