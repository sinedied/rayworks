import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';

export function Modal({
  title, children, onClose, wide = false, closeDisabled = false, initialFocusRef,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  closeDisabled?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    initialFocusRef?.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [initialFocusRef]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal-card${wide ? ' wide' : ''}`}
      onCancel={event => { event.preventDefault(); if (!closeDisabled) onClose(); }}
    >
      <header className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="modal-close" aria-label="Close dialog" disabled={closeDisabled} onClick={onClose}>×</button>
      </header>
      {children}
    </dialog>
  );
}
