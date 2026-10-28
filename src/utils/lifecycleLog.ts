import { useEffect } from 'react';

/** Écrit dans le terminal quand un écran apparaît et disparaît (réservé au débogage). */
export function useLifecycleLog(name: string) {
  useEffect(() => {
    if (!__DEV__) return;
    console.log(`[cycle] ${name} monté`);
    return () => console.log(`[cycle] ${name} démonté`);
  }, [name]);
}