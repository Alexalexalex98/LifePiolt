import { create } from 'zustand';

type ToastState = {
  msg: string | null;
  undo: (() => void) | null;
  id: number;
  show: (msg: string, undo?: () => void) => void;
  hide: () => void;
};

export const useToast = create<ToastState>((set) => ({
  msg: null,
  undo: null,
  id: 0,
  show: (msg, undo) => set((s) => ({ msg, undo: undo ?? null, id: s.id + 1 })),
  hide: () => set({ msg: null, undo: null }),
}));

export const toast = (msg: string) => useToast.getState().show(msg);
export const showUndoToast = (msg: string, undo: () => void) => useToast.getState().show(msg, undo);
