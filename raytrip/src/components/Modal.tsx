import { useEffect, useId, useRef, type ReactNode } from 'react';

export function Modal({
  title, children, onClose, wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal-card${wide ? ' wide' : ''}`}
      onCancel={event => { event.preventDefault(); onClose(); }}
    >
      <header className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="modal-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </header>
      {children}
    </dialog>
  );
}
