// @ts-nocheck
// Valeurs connues de l'app (types, couleurs, occasions) et lecture du JSON renvoyé par Gemini.

export const TYPES = [
  'tshirt', 'chemise', 'pull', 'veste', 'veste_legere', 'veste_epaisse', 'pantalon', 'short', 'jupe', 'robe',
  'chaussures', 'echarpe', 'bonnet', 'parapluie', 'sac', 'ceinture', 'casquette', 'lunettes', 'gants', 'montre', 'bijoux',
];
export const COLORS = ['noir', 'blanc', 'gris', 'beige', 'marine', 'marron', 'bleu', 'rouge', 'vert', 'jaune', 'orange', 'rose', 'violet'];
export const STYLES = ['casual', 'sport', 'formel', 'soiree'];

export const TYPE_HINT = 'veste_legere = coupe-vent, bomber, perfecto ; veste_epaisse = manteau, doudoune, parka';

/** Extrait un objet JSON du texte, même entouré de ```json ou de phrases ; null si illisible. */
export function parseJsonObject(text: string) {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  for (const candidate of [cleaned, cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1)]) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object') return value;
    } catch {}
  }
  return null;
}

/** Ne garde que les couleurs et occasions connues. */
export const cleanColors = (raw) => (Array.isArray(raw) ? raw : []).filter((c) => COLORS.includes(c)).slice(0, 3);
export const cleanStyles = (raw) => (Array.isArray(raw) ? raw : []).filter((s) => STYLES.includes(s));
