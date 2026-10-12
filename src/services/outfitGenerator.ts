import { daysAgo, signatureOfIds } from '@/services/historyUtils';
import { allColors } from '@/types';
import type {
  ClothingItem, ClothingType, ColorName, Outfit, Style, Weather, WornOutfit,
} from '@/types';

// ---------- Couleurs ----------
const NEUTRALS: ColorName[] = ['noir', 'blanc', 'gris', 'beige', 'marine', 'marron'];

// Paires de couleurs vives qui fonctionnent ensemble (symétriques)
const VIVID_OK: [ColorName, ColorName][] = [
  ['bleu', 'jaune'], ['bleu', 'orange'], ['vert', 'jaune'],
  ['rose', 'violet'], ['bleu', 'rose'], ['vert', 'orange'],
];

const isNeutral = (c: ColorName) => NEUTRALS.includes(c);

/** Score d'harmonie entre deux couleurs (plus c'est haut, mieux c'est). */
function colorPairScore(a: ColorName, b: ColorName): number {
  if (isNeutral(a) && isNeutral(b)) {
    // Marine + marron = faux pas classique
    if ((a === 'marine' && b === 'marron') || (a === 'marron' && b === 'marine')) return -2;
    return 3;
  }
  if (isNeutral(a) || isNeutral(b)) return 2;   // neutre + vive : la base d'une bonne tenue
  if (a === b) return 1;                         // camaïeu
  const ok = VIVID_OK.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return ok ? 1 : -3;                            // deux vives qui jurent
}

/** Score entre deux vêtements : moyenne sur toutes leurs couleurs (un t-shirt rayé en a plusieurs). */
function itemPairScore(a: ClothingItem, b: ClothingItem): number {
  const ca = allColors(a);
  const cb = allColors(b);
  let sum = 0;
  for (const x of ca) for (const y of cb) sum += colorPairScore(x, y);
  return sum / (ca.length * cb.length);
}

/** Score global d'une tenue : harmonie par paires + pénalités vives / motifs. */
function scoreOutfit(items: ClothingItem[]): number {
  let score = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      score += itemPairScore(items[i], items[j]);
    }
  }
  // Couleurs vives distinctes sur l'ensemble de la tenue
  const vivid = new Set(items.flatMap(allColors).filter((c) => !isNeutral(c)));
  if (vivid.size > 2) score -= (vivid.size - 2) * 3;
  const patterns = items.filter((i) => i.pattern === 'motif').length;
  if (patterns > 1) score -= (patterns - 1) * 4;               // mélange de motifs
  return score;
}

// ---------- Historique : éviter de répéter les mêmes vêtements ----------
const SAME_OUTFIT_DAYS = 6; // la même tenue exacte est écartée si portée dans les 7 derniers jours

// Importance de la répétition selon le type : une veste ou des chaussures se reportent sans souci
const REPEAT_WEIGHT: Record<ClothingType, number> = {
  tshirt: 1, chemise: 1, pantalon: 0.6, short: 0.6, pull: 0.5, veste: 0, chaussures: 0,
};

const TYPE_NAMES: Record<ClothingType, string> = {
  tshirt: 'T-shirt', chemise: 'Chemise', pull: 'Pull', veste: 'Veste',
  pantalon: 'Pantalon', short: 'Short', chaussures: 'Chaussures',
};

/** Pénalité pour les vêtements portés récemment (aujourd'hui/hier > avant-hier > il y a 3 jours). */
function repeatPenalty(items: ClothingItem[], lastWorn: Map<string, number>): number {
  let penalty = 0;
  for (const item of items) {
    const d = lastWorn.get(item.id);
    if (d === undefined) continue;
    const decay = d <= 1 ? 5 : d === 2 ? 3 : d === 3 ? 1.5 : 0;
    penalty += REPEAT_WEIGHT[item.type] * decay;
  }
  return penalty;
}

// ---------- Plan météo ----------
interface Plan {
  bottoms: ClothingType[];
  tops: ClothingType[];
  needSweater: boolean;
  needJacket: boolean;
}

function planFromWeather(w: Weather): Plan {
  const rainy = w.precipitation > 0.2;
  const windy = w.windSpeed > 30;
  const t = w.temperature;

  if (t >= 24) {
    return { bottoms: ['short'], tops: ['tshirt'], needSweater: false, needJacket: rainy };
  }
  if (t >= 18) {
    return {
      bottoms: ['pantalon', 'short'], tops: ['tshirt', 'chemise'],
      needSweater: false, needJacket: rainy || windy,
    };
  }
  if (t >= 10) {
    return {
      bottoms: ['pantalon'], tops: ['tshirt', 'chemise'],
      needSweater: true, needJacket: rainy || windy,
    };
  }
  // Froid : base + pull + veste
  return { bottoms: ['pantalon'], tops: ['tshirt', 'chemise'], needSweater: true, needJacket: true };
}

// ---------- Génération ----------
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const signature = (items: ClothingItem[]) => signatureOfIds(items.map((i) => i.id));

/**
 * Génère une tenue.
 * @param exclude signatures déjà proposées (pour « Autre tenue »)
 * @param history tenues déjà portées : on évite de les répéter
 */
export function generateOutfit(
  wardrobe: ClothingItem[],
  weather: Weather,
  occasion: Style,
  exclude: Set<string> = new Set(),
  history: WornOutfit[] = [],
): Outfit | null {
  const notes: string[] = [];
  const plan = planFromWeather(weather);

  // Seuls les vêtements propres sont proposés ; on filtre par occasion,
  // avec repli sur tout le dressing propre si rien ne correspond.
  const clean = wardrobe.filter((i) => i.clean);
  const candidates = (types: ClothingType[], label: string): ClothingItem[] => {
    const ofType = clean.filter((i) => types.includes(i.type));
    const matching = ofType.filter((i) => i.styles.includes(occasion));
    if (matching.length > 0) return matching;
    if (ofType.length > 0) {
      notes.push(`${label} : aucun vêtement « ${occasion} » propre, choix hors style.`);
      return ofType;
    }
    notes.push(`${label} : aucun vêtement propre disponible.`);
    return [];
  };

  const tops = candidates(plan.tops, 'Haut');
  const bottoms = candidates(plan.bottoms, 'Bas');
  const shoes = candidates(['chaussures'], 'Chaussures');
  const sweaters = plan.needSweater ? candidates(['pull'], 'Pull') : [];
  const jackets = plan.needJacket ? candidates(['veste'], 'Veste') : [];

  // Sans haut ni bas, impossible de composer une tenue
  if (tops.length === 0 || bottoms.length === 0) return null;

  // Historique : dernier jour de port de chaque vêtement + tenues exactes déjà portées récemment
  const lastWorn = new Map<string, number>(); // id -> nombre de jours depuis le dernier port
  const recentSigs = new Set<string>();
  for (const h of history) {
    const d = daysAgo(h.wornAt);
    for (const id of h.itemIds) {
      const prev = lastWorn.get(id);
      if (prev === undefined || d < prev) lastWorn.set(id, d);
    }
    if (d <= SAME_OUTFIT_DAYS) recentSigs.add(signatureOfIds(h.itemIds));
  }

  // Échantillonnage aléatoire puis sélection parmi les meilleures combinaisons
  const sample = (blocked: Set<string>) => {
    const tries: { items: ClothingItem[]; score: number }[] = [];
    const seen = new Set<string>();

    for (let n = 0; n < 80; n++) {
      const items = [pick(tops), pick(bottoms)];
      if (shoes.length) items.push(pick(shoes));
      if (sweaters.length) items.push(pick(sweaters));
      if (jackets.length) items.push(pick(jackets));

      const sig = signature(items);
      if (seen.has(sig) || blocked.has(sig)) continue;
      seen.add(sig);
      tries.push({ items, score: scoreOutfit(items) - repeatPenalty(items, lastWorn) });
    }

    if (tries.length === 0) return null;
    tries.sort((a, b) => b.score - a.score);
    return pick(tries.slice(0, 3)); // un peu de variété parmi le top 3
  };

  // 1re tentative : sans les tenues déjà proposées ni les tenues portées cette semaine
  let best = sample(new Set([...exclude, ...recentSigs]));

  // Pas assez de vêtements pour varier : on accepte une tenue récente plutôt que rien
  if (!best && recentSigs.size > 0) {
    best = sample(exclude);
    if (best) notes.push('Tenue déjà portée récemment : pas assez de vêtements propres pour varier.');
  }
  if (!best) return null; // toutes les combinaisons ont déjà été proposées

  // Prévient si une pièce principale a été portée aujourd'hui ou hier
  for (const item of best.items) {
    const d = lastWorn.get(item.id);
    if (d !== undefined && d <= 1 && REPEAT_WEIGHT[item.type] >= 0.6) {
      notes.push(`${TYPE_NAMES[item.type]} déjà porté ${d === 0 ? "aujourd'hui" : 'hier'}.`);
    }
  }

  return { items: best.items, score: best.score, notes };
}

export { signature as outfitSignature };