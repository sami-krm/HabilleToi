// Dates du séjour en texte « AAAA-MM-JJ » (heure locale), faciles à comparer et à stocker.
const pad = (n: number) => String(n).padStart(2, '0');

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayISO = () => toISO(new Date());

export const addDaysISO = (s: string, n: number) => {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Nombre de jours entre a et b (b - a). */
export const diffDays = (a: string, b: string) =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);

export const formatShort = (s: string) =>
  parseISO(s).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

export const formatDay = (s: string) =>
  parseISO(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });