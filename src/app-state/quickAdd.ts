import type { TxType } from '../db/types';

/** A tiny event so any screen can open the quick-add sheet (the host lives in the tab layout). */
type Listener = (type: TxType) => void;
const listeners = new Set<Listener>();

export function openQuickAdd(type: TxType = 'expense'): void {
  listeners.forEach((l) => l(type));
}

export function onQuickAddRequested(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
