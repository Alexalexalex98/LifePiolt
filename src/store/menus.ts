import { create } from 'zustand';

import { EMPTY_MENU, MAX_FILES, MAX_ITEMS, type Menu, type MenuFile, type MenuItem } from '@/lib/menu';
import { persisted } from './persist';

type MenusState = {
  /** il menù di ogni attività, per nome del profilo (come compare negli autori dei post) */
  byOwner: Record<string, Menu>;
  addFiles: (owner: string, files: MenuFile[]) => void;
  removeFile: (owner: string, id: string) => void;
  saveItem: (owner: string, item: MenuItem) => void;
  removeItem: (owner: string, id: string) => void;
  /** per i dati di esempio: sostituisce il menù di un'attività */
  setMenu: (owner: string, menu: Menu) => void;
  reset: () => void;
};

const upd = (s: MenusState, owner: string, f: (m: Menu) => Menu): Pick<MenusState, 'byOwner'> => ({ byOwner: { ...s.byOwner, [owner]: { ...f(s.byOwner[owner] ?? EMPTY_MENU), updatedAt: Date.now() } } });

export const useMenus = create<MenusState>()(persisted('menus', (set) => ({
  byOwner: {},
  addFiles: (owner, files) => set((s) => upd(s, owner, (m) => ({ ...m, files: [...m.files, ...files].slice(0, MAX_FILES) }))),
  removeFile: (owner, id) => set((s) => upd(s, owner, (m) => ({ ...m, files: m.files.filter((f) => f.id !== id) }))),
  saveItem: (owner, item) => set((s) => upd(s, owner, (m) => ({ ...m, items: m.items.some((x) => x.id === item.id) ? m.items.map((x) => (x.id === item.id ? item : x)) : [...m.items, item].slice(0, MAX_ITEMS) }))),
  removeItem: (owner, id) => set((s) => upd(s, owner, (m) => ({ ...m, items: m.items.filter((x) => x.id !== id) }))),
  setMenu: (owner, menu) => set((s) => ({ byOwner: { ...s.byOwner, [owner]: menu } })),
  reset: () => set({ byOwner: {} }),
}), (s) => ({ byOwner: s.byOwner } as Partial<MenusState>)));
