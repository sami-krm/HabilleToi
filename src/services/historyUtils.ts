const DAY_MS = 86_400_000;

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Nombre de jours calendaires entre t et now (0 = aujourd'hui, 1 = hier...). */
export function daysAgo(t: number, now: number = Date.now()): number {
  return Math.round((startOfDay(now) - startOfDay(t)) / DAY_MS);
}

/** Clé de jour locale, ex. « 2026-10-12 », pour regrouper les tenues par jour. */
export function dayKey(t: number): string {
  const d = new Date(t);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Signature d'une tenue : mêmes vêtements = même signature, quel que soit l'ordre. */
export const signatureOfIds = (ids: string[]) => [...ids].sort().join('|');