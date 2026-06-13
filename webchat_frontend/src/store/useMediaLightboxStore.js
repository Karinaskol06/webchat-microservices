import { create } from 'zustand';

const useMediaLightboxStore = create((set, get) => ({
  open: false,
  items: [],
  index: 0,

  openLightbox: ({ items, initialIndex = 0 }) => {
    const list = Array.isArray(items) ? items.filter((item) => item?.id != null) : [];
    if (list.length === 0) return;

    const safeIndex = Math.min(Math.max(0, initialIndex), list.length - 1);
    set({ open: true, items: list, index: safeIndex });
  },

  close: () => set({ open: false, items: [], index: 0 }),

  next: () => {
    const { items, index } = get();
    if (items.length <= 1) return;
    set({ index: (index + 1) % items.length });
  },

  prev: () => {
    const { items, index } = get();
    if (items.length <= 1) return;
    set({ index: (index - 1 + items.length) % items.length });
  },
}));

export default useMediaLightboxStore;
