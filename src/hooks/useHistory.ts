import { useCallback, useState } from 'react';

import { loadHistory, saveHistory } from '@/storage/wardrobeStorage';
import type { WornOutfit } from '@/types';

const MAX_ENTRIES = 365; // on garde environ un an d'historique

export function useHistory() {
  const [entries, setEntries] = useState<WornOutfit[]>([]);

  const reload = useCallback(async () => setEntries(await loadHistory()), []);

  const persist = useCallback(async (next: WornOutfit[]) => {
    setEntries(next);
    await saveHistory(next);
  }, []);

  /** Enregistre une tenue portée maintenant (les plus récentes en premier). */
  const addWorn = useCallback(async (itemIds: string[]) => {
    const now = Date.now();
    const entry: WornOutfit = { id: String(now), itemIds, wornAt: now };
    const current = await loadHistory(); // relit le stockage pour ne rien écraser
    await persist([entry, ...current].slice(0, MAX_ENTRIES));
  }, [persist]);

  const removeEntry = useCallback(async (id: string) => {
    const current = await loadHistory();
    await persist(current.filter((e) => e.id !== id));
  }, [persist]);

  const clearAll = useCallback(() => persist([]), [persist]);

  return { entries, reload, addWorn, removeEntry, clearAll };
}