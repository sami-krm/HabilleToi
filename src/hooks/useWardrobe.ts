import { useCallback, useState } from 'react';
import type { ClothingItem } from '../types';
import { loadWardrobe, saveWardrobe } from '../storage/wardrobeStorage';

export function useWardrobe() {
  const [items, setItems] = useState<ClothingItem[]>([]);

  const reload = useCallback(async () => setItems(await loadWardrobe()), []);

  const persist = useCallback(async (next: ClothingItem[]) => {
    setItems(next);
    await saveWardrobe(next);
  }, []);

  const addItem = (item: ClothingItem) => persist([...items, item]);
  const removeItem = (id: string) => persist(items.filter((i) => i.id !== id));

  /** Modifie un vêtement existant (type, couleurs, occasions, motif...). */
  const updateItem = (id: string, patch: Partial<Omit<ClothingItem, 'id'>>) =>
    persist(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  /** Marque des vêtements comme sales (false) ou lavés (true). */
  const setClean = (ids: string[], clean: boolean) =>
    persist(items.map((i) => (ids.includes(i.id) ? { ...i, clean } : i)));

  return { items, reload, addItem, removeItem, updateItem, setClean };
}