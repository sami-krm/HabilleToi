import type { DayOutfit, DayWeather } from '@/features/trip/tripTypes';
import { itemPairScore } from '@/services/outfitGenerator';
import type { ClothingItem, ClothingType, ColorName, Style } from '@/types';

export const PACK_ORDER: ClothingType[] = ['tshirt', 'chemise', 'pull', 'veste', 'pantalon', 'short', 'chaussures'];

const SINGULAR: Record<ClothingType, string> = {
  tshirt: 'T-shirt', chemise: 'Chemise', pull: 'Pull', veste: 'Veste',
  pantalon: 'Pantalon', short: 'Short', chaussures: 'Chaussures',
};
const PLURAL: Record<ClothingType, string> = {
  tshirt: 'T-shirts', chemise: 'Chemises', pull: 'Pulls', veste: 'Vestes',
  pantalon: 'Pantalons', short: 'Shorts', chaussures: 'Chaussures',
};
export const typeSingular = (t: ClothingType) => SINGULAR[t];
export const typePlural = (t: ClothingType) => PLURAL[t];

const NEUTRALS: ColorName[] = ['noir', 'blanc', 'gris', 'beige', 'marine', 'marron'];
const isNeutralItem = (i: ClothingItem) => NEUTRALS.includes(i.color);

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// ---------- Besoins d'une journée (mêmes seuils que le générateur de tenues) ----------
interface DayNeed {
  date: string;
  tops: ClothingType[];
  bottoms: ClothingType[]; // le premier est le type préféré
  sweater: boolean;
  jacket: boolean;
  rain: boolean;
}

function needFor(d: DayWeather): DayNeed {
  const feels = 0.6 * d.tMax + 0.4 * d.tMin; // la journée pèse plus que la nuit
  const rain = d.precipitation >= 1;
  const wind = d.windMax > 30;

  const bottoms: ClothingType[] =
    feels >= 24 ? ['short'] : feels >= 21 ? ['short', 'pantalon'] : feels >= 18 ? ['pantalon', 'short'] : ['pantalon'];

  return {
    date: d.date,
    tops: feels >= 24 ? ['tshirt'] : ['tshirt', 'chemise'],
    bottoms,
    sweater: feels < 18 || d.tMin < 12,
    jacket: rain || wind || feels < 10,
    rain,
  };
}

// ---------- Choix glouton des pièces ----------
/** Retient `count` pièces qui vont bien avec les `anchors`, en évitant les doublons de couleur. */
function pickBest(
  pool: ClothingItem[],
  count: number,
  anchors: ClothingItem[],
  occasionIds: Set<string>,
  variation: number,
  already: ClothingItem[] = [],
): ClothingItem[] {
  const picked: ClothingItem[] = [];
  const remaining = [...pool];

  while (picked.length < count && remaining.length > 0) {
    const group = [...already, ...picked];
    let bestIndex = 0;
    let bestScore = -Infinity;

    remaining.forEach((c, idx) => {
      let s = anchors.length > 0
        ? anchors.reduce((sum, a) => sum + itemPairScore(c, a), 0) / anchors.length
        : isNeutralItem(c) ? 2 : 0; // sans point d'appui, on part sur une base neutre
      if (occasionIds.has(c.id)) s += 1.5;
      s -= group.filter((g) => g.type === c.type && g.color === c.color).length * 2;
      if (c.pattern === 'motif') s -= group.filter((g) => g.pattern === 'motif').length * 2 + 0.5;
      s += Math.random() * variation;
      if (s > bestScore) { bestScore = s; bestIndex = idx; }
    });

    picked.push(remaining.splice(bestIndex, 1)[0]);
  }
  return picked;
}

/** Score moyen d'une pièce avec un ensemble de pièces déjà choisies. */
const meanScore = (c: ClothingItem, others: ClothingItem[]) =>
  others.length === 0 ? 0 : others.reduce((sum, o) => sum + itemPairScore(c, o), 0) / others.length;

// ---------- Résultat ----------
export interface PackingResult {
  items: ClothingItem[];
  dayOutfits: DayOutfit[];
  notes: string[];
  /** Nombre de paires haut + bas qui vont bien ensemble. */
  combos: number;
}

interface Params {
  wardrobe: ClothingItem[];
  days: DayWeather[];
  occasions: Style[];
  /** 0 = toujours la même sélection, plus haut = plus de variété (« Autre sélection »). */
  variation?: number;
}

export function generatePacking({ wardrobe, days, occasions, variation = 0.6 }: Params): PackingResult {
  const notes: string[] = [];
  const needs = days.map(needFor);
  const N = needs.length;

  // Les vêtements sales comptent : ils seront lavés avant le départ
  const poolOf = (types: ClothingType[]) => wardrobe.filter((i) => types.includes(i.type));
  const occasionIds = new Set(
    wardrobe.filter((i) => i.styles.some((s) => occasions.includes(s))).map((i) => i.id),
  );

  // ----- Quantités visées -----
  const shortDays = needs.filter((n) => n.bottoms[0] === 'short').length;
  const pantalonDays = N - shortDays;
  const hotDays = needs.filter((n) => n.tops.length === 1).length;
  const sweaterDays = needs.filter((n) => n.sweater).length;
  const jacketDays = needs.filter((n) => n.jacket).length;

  const want: Record<ClothingType, number> = {
    tshirt: 0, chemise: 0,
    pantalon: pantalonDays > 0 ? clamp(Math.ceil(pantalonDays / 3), 1, 3) : 0,
    short: shortDays > 0 ? clamp(Math.ceil(shortDays / 3), 1, 3) : 0,
    pull: sweaterDays > 0 ? clamp(Math.ceil(sweaterDays / 4), 1, 2) : 0,
    veste: jacketDays > 0 ? (jacketDays >= 5 ? 2 : 1) : 0,
    chaussures: N <= 3 ? 1 : 2,
  };
  const wantTops = clamp(Math.ceil(N * 0.7), 1, 8); // on suppose une lessive possible au-delà d'une semaine

  // Pas de short dans le dressing : les jours chauds se feront en pantalon
  if (want.short > 0 && poolOf(['short']).length === 0) {
    want.pantalon = clamp(want.pantalon + want.short, 1, 3);
    want.short = 0;
    notes.push('Aucun short dans ton dressing : prévois-en un pour les jours chauds.');
  }

  // ----- Sélection, dans un ordre qui construit la cohérence -----
  const bottoms = [
    ...pickBest(poolOf(['pantalon']), want.pantalon, [], occasionIds, variation),
    ...pickBest(poolOf(['short']), want.short, [], occasionIds, variation),
  ];
  const shoes = pickBest(poolOf(['chaussures']), want.chaussures, bottoms, occasionIds, variation);

  const topPool = hotDays === N ? poolOf(['tshirt']) : poolOf(['tshirt', 'chemise']);
  const minTshirts = hotDays > 0 ? clamp(Math.ceil(hotDays * 0.7), 1, wantTops) : 0;
  const tshirts = pickBest(poolOf(['tshirt']), minTshirts, bottoms, occasionIds, variation);
  const otherTops = pickBest(
    topPool.filter((i) => !tshirts.includes(i)),
    wantTops - tshirts.length, bottoms, occasionIds, variation, tshirts,
  );
  const tops = [...tshirts, ...otherTops];

  const base = [...tops, ...bottoms];
  const sweaters = pickBest(poolOf(['pull']), want.pull, base, occasionIds, variation);
  const jackets = pickBest(poolOf(['veste']), want.veste, [...base, ...shoes], occasionIds, variation);

  const items = [...tops, ...bottoms, ...shoes, ...sweaters, ...jackets];

  // ----- Remarques sur ce qui manque -----
  const got: Record<ClothingType, number> = {
    tshirt: tshirts.length + otherTops.filter((i) => i.type === 'tshirt').length,
    chemise: otherTops.filter((i) => i.type === 'chemise').length,
    pantalon: bottoms.filter((i) => i.type === 'pantalon').length,
    short: bottoms.filter((i) => i.type === 'short').length,
    pull: sweaters.length, veste: jackets.length, chaussures: shoes.length,
  };
  const needsByType: Partial<Record<ClothingType, number>> = {
    pantalon: want.pantalon, short: want.short, pull: want.pull, veste: want.veste, chaussures: want.chaussures,
  };
  for (const [type, n] of Object.entries(needsByType) as [ClothingType, number][]) {
    if (n === 0) continue;
    if (got[type] === 0) {
      if (type === 'short' && want.short === 0) continue; // déjà signalé plus haut
      notes.push(`${SINGULAR[type]} : aucune pièce dans ton dressing, prévois-en ${type === 'chaussures' ? 'une paire' : 'une'}.`);
    } else if (got[type] < n) {
      notes.push(`${PLURAL[type]} : seulement ${got[type]} dans ton dressing (idéal : ${n}).`);
    }
  }
  if (tops.length < wantTops) {
    notes.push(`Hauts : seulement ${tops.length} dans ton dressing (idéal : ${wantTops}).`);
  }
  const rainDays = needs.filter((n) => n.rain).length;
  if (rainDays > 0) {
    notes.push(`Pluie prévue ${rainDays} jour${rainDays > 1 ? 's' : ''} : pense à un parapluie ou une veste imperméable.`);
  }
  if (occasions.length > 0 && items.some((i) => !occasionIds.has(i.id))) {
    notes.push('Certaines pièces ne sont pas marquées pour tes occasions : faute de mieux, elles complètent la valise.');
  }

  // ----- Une tenue par jour, sans répéter les mêmes pièces trop souvent -----
  const used = new Map<string, number>();
  const bump = (i: ClothingItem) => used.set(i.id, (used.get(i.id) ?? 0) + 1);
  const useCount = (i: ClothingItem) => used.get(i.id) ?? 0;

  const bestOf = (cands: ClothingItem[], outfit: ClothingItem[], repeatWeight: number) => {
    let best: ClothingItem | null = null;
    let bestScore = -Infinity;
    for (const c of cands) {
      const s = meanScore(c, outfit) - useCount(c) * repeatWeight;
      if (s > bestScore) { bestScore = s; best = c; }
    }
    return best;
  };

  const dayOutfits: DayOutfit[] = needs.map((need) => {
    const topCands = tops.filter((t) => need.tops.includes(t.type));
    const bottomCands = bottoms.filter((b) => need.bottoms.includes(b.type));
    const ts = topCands.length > 0 ? topCands : tops;
    const bs = bottomCands.length > 0 ? bottomCands : bottoms;

    let pair: [ClothingItem, ClothingItem] | null = null;
    let pairScore = -Infinity;
    for (const t of ts) {
      for (const b of bs) {
        const s = itemPairScore(t, b) - useCount(t) * 3 - useCount(b) + (b.type === need.bottoms[0] ? 1 : 0);
        if (s > pairScore) { pairScore = s; pair = [t, b]; }
      }
    }
    if (!pair) return { date: need.date, itemIds: [] };

    const outfit: ClothingItem[] = [...pair];
    const add = (cands: ClothingItem[], weight: number) => {
      const c = bestOf(cands, outfit, weight);
      if (c) outfit.push(c);
    };
    add(shoes, 0.5);
    if (need.sweater) add(sweaters, 1);
    if (need.jacket) add(jackets, 0.3);

    outfit.forEach(bump);
    return { date: need.date, itemIds: outfit.map((i) => i.id) };
  });

  // ----- Nombre de combinaisons haut + bas qui fonctionnent -----
  let combos = 0;
  for (const t of tops) for (const b of bottoms) if (itemPairScore(t, b) >= 0) combos++;

  return { items, dayOutfits, notes, combos };
}