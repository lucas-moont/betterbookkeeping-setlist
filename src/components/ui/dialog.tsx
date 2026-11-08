import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  /** Runs on Esc, on a click on the scrim, and whenever the screen asks to close. */
  onClose: () => void;
  title: string;
  description?: string;
  /**
   * Where the focus starts. "content" is the browser's choice, the first control (a form's first
   * field). "title" focuses the title instead, for a choice with no default: a stray Enter then
   * presses nothing.
   */
  initialFocus?: "content" | "title";
  /** Where the focus goes once it closes. Without it, the browser returns it to whatever opened the dialog. */
  returnFocus?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}

/**
 * A modal dialog over the page, built on the native <dialog> element: showModal() keeps the focus
 * inside, makes the page behind it inert, and closes on Esc. Its panel is a card over a scrim
 * (DESIGN.md, The Flat Card Rule). The children mount only while it is open, so a form inside
 * starts fresh every time.
 */
function Dialog({
  open,
  onClose,
  title,
  description,
  initialFocus = "content",
  returnFocus,
  className,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (initialFocus === "title") titleRef.current?.focus();
    }
    if (!open && dialog.open) {
      // close() puts the focus back where it was before showModal(), so returnFocus comes after it.
      dialog.close();
      returnFocus?.current?.focus();
    }
  }, [open, initialFocus, returnFocus]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Esc fires "cancel": the parent decides, so the open prop stays the one source of truth.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the scrim lands on the <dialog> itself; clicks inside land on the panel.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        // Tailwind's preflight removes the margin that centers a modal <dialog>, so m-auto puts it back.
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-sm",
        "backdrop:bg-slate-900/40",
        className,
      )}>
      {open && (
        <div className="space-y-4 p-6">
          <div className="space-y-1.5">
            <h2
              ref={titleRef}
              id={titleId}
              // Focusable only from code, so Tab still moves between the controls alone.
              tabIndex={initialFocus === "title" ? -1 : undefined}
              className="text-lg font-semibold leading-none tracking-tight text-slate-900 focus:outline-none">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export { Dialog };
export type { DialogProps };
