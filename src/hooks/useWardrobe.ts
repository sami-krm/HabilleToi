import { useCallback, useRef, useState } from 'react';
import type { ClothingItem } from '../types';
import { loadWardrobe, saveWardrobe } from '../storage/wardrobeStorage';

export function useWardrobe() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  // Copie à jour du dressing : deux modifications rapprochées ne s'écrasent pas
  const itemsRef = useRef<ClothingItem[]>([]);

  const reload = useCallback(async () => {
    const loaded = await loadWardrobe();
    itemsRef.current = loaded;
    setItems(loaded);
  }, []);

  const persist = useCallback(async (change: (current: ClothingItem[]) => ClothingItem[]) => {
    const next = change(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
    await saveWardrobe(next);
  }, []);

  const addItem = useCallback((item: ClothingItem) => persist((cur) => [...cur, item]), [persist]);
  const removeItem = useCallback((id: string) => persist((cur) => cur.filter((i) => i.id !== id)), [persist]);

  /** Modifie un vêtement existant (type, couleurs, occasions, motif...). */
  const updateItem = useCallback((id: string, patch: Partial<Omit<ClothingItem, 'id'>>) =>
    persist((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i))), [persist]);

  /** Marque des vêtements comme sales (false) ou lavés (true). */
  const setClean = useCallback((ids: string[], clean: boolean) =>
    persist((cur) => cur.map((i) => (ids.includes(i.id) ? { ...i, clean, ...(clean ? { lastWashedAt: Date.now() } : {}) } : i))), [persist]);

  return { items, reload, addItem, removeItem, updateItem, setClean };
}
