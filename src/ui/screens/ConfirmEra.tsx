/**
 * Starts, disease, predators (Task 2): "Are you sure?" before a world starts after Prehistoric. A native modal
 * <dialog> (the page behind it is inert), named by its title, with focus on Cancel, Tab kept inside and
 * Escape as Cancel. The caller puts focus back on "Create world" when it closes.
 */
import { useEffect, useRef } from 'preact/hooks';
import { ERA_NAMES } from '../../technology/techData';

export function ConfirmEra({ era, onConfirm, onCancel }: { era: number; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const name = ERA_NAMES[era];
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    cancelRef.current?.focus();
    // Escape fires 'cancel' on a modal dialog: treat it as the Cancel button
    const esc = (e: Event) => { e.preventDefault(); onCancel(); };
    d.addEventListener('cancel', esc);
    return () => {
      d.removeEventListener('cancel', esc);
      if (d.open) d.close();
    };
  }, []);
  // keep Tab inside the dialog (a modal dialog may otherwise hand focus to the browser's own controls)
  const trap = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    if (!btns.length) return;
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.shiftKey ? (i <= 0 ? btns.length - 1 : i - 1) : (i + 1) % btns.length;
    e.preventDefault();
    btns[next].focus();
  };
  return (
    <dialog ref={ref} class="confirm" aria-modal="true" aria-labelledby="era-confirm-title" aria-describedby="era-confirm-body" data-testid="era-confirm" onKeyDown={trap}>
      <h2 id="era-confirm-title">Start in the {name} era?</h2>
      <p id="era-confirm-body">Nations, towns and technology will already exist, so you skip the start from nothing.</p>
      <div class="confirm-actions">
        <button ref={cancelRef} class="btn" onClick={onCancel}>Cancel</button>
        <button class="btn primary" onClick={onConfirm}>Start in {name}</button>
      </div>
    </dialog>
  );
}
