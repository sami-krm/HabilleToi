// Libellés et couleurs partagés par tous les écrans (dressing, tenue, valise, import...).
import type { ClothingType, ColorName, Style } from '@/types';

export const TYPE_LABELS: Record<ClothingType, string> = {
  tshirt: 'T-shirt', chemise: 'Chemise', pull: 'Pull', veste: 'Veste',
  veste_legere: 'Veste légère', veste_epaisse: 'Veste chaude',
  pantalon: 'Pantalon', short: 'Short', jupe: 'Jupe', robe: 'Robe',
  chaussures: 'Chaussures', echarpe: 'Écharpe', bonnet: 'Bonnet', parapluie: 'Parapluie',
};

export const TYPE_PLURALS: Record<ClothingType, string> = {
  tshirt: 'T-shirts', chemise: 'Chemises', pull: 'Pulls', veste: 'Vestes',
  veste_legere: 'Vestes légères', veste_epaisse: 'Vestes chaudes',
  pantalon: 'Pantalons', short: 'Shorts', jupe: 'Jupes', robe: 'Robes',
  chaussures: 'Chaussures', echarpe: 'Écharpes', bonnet: 'Bonnets', parapluie: 'Parapluies',
};

export const TYPE_ORDER = Object.keys(TYPE_LABELS) as ClothingType[];

export const JACKET_TYPES: ClothingType[] = ['veste', 'veste_legere', 'veste_epaisse'];
export const isJacket = (t: ClothingType) => JACKET_TYPES.includes(t);

export const COLOR_HEX: Record<ColorName, string> = {
  noir: '#111111', blanc: '#FFFFFF', gris: '#9E9E9E', beige: '#D8C3A5',
  marine: '#1F2A44', marron: '#6B4423', bleu: '#2F6FED', rouge: '#D32F2F',
  vert: '#2E8B57', jaune: '#F4C430', orange: '#F57C00', rose: '#F48FB1', violet: '#7E57C2',
};

export const COLOR_ORDER = Object.keys(COLOR_HEX) as ColorName[];

export const STYLE_OPTIONS: { key: Style; label: string }[] = [
  { key: 'casual', label: 'Casual' },
  { key: 'sport', label: 'Sport' },
  { key: 'formel', label: 'Formel' },
  { key: 'soiree', label: 'Soirée' },
];

export const STYLE_ORDER = STYLE_OPTIONS.map((s) => s.key);
