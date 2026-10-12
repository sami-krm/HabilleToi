import type { ClothingType, ColorName, Style } from '@/types';

export interface Suggestion {
  type?: ClothingType;
  colors?: ColorName[];   // 1 à 3 couleurs, la dominante en premier
  pattern?: 'uni' | 'motif';
  styles?: Style[];
}

const TYPES: ClothingType[] = ['tshirt', 'chemise', 'pull', 'veste', 'pantalon', 'short', 'chaussures'];
const COLORS: ColorName[] = [
  'noir', 'blanc', 'gris', 'beige', 'marine', 'marron',
  'bleu', 'rouge', 'vert', 'jaune', 'orange', 'rose', 'violet',
];
const STYLES: Style[] = ['casual', 'sport', 'formel', 'soiree'];
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_COLORS = 3;

const ENDPOINT = process.env.EXPO_PUBLIC_RECOGNITION_URL;
const TOKEN = process.env.EXPO_PUBLIC_APP_TOKEN;

/**
 * Envoie la photo au Worker et renvoie une suggestion validée.
 * Renvoie null si la reconnaissance n'est pas configurée ou ne trouve rien.
 */
export async function recognizeClothing(
  imageBase64: string,
  mediaType = 'image/jpeg',
): Promise<Suggestion | null> {
  if (!ENDPOINT || !TOKEN) return null;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-app-token': TOKEN },
    body: JSON.stringify({
      imageBase64,
      mediaType: MEDIA_TYPES.includes(mediaType) ? mediaType : 'image/jpeg',
    }),
  });
  if (!res.ok) throw new Error(`Reconnaissance : HTTP ${res.status} ${await res.text()}`);

  const { text } = (await res.json()) as { text: string };
  const match = text.match(/\{[\s\S]*\}/); // tolère un éventuel texte autour du JSON
  if (!match) return null;

  let raw: any;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    return null;
  }

  // On ne garde que des valeurs reconnues par l'app
  const suggestion: Suggestion = {};
  if (TYPES.includes(raw.type)) suggestion.type = raw.type;

  // Accepte "colors" (liste) ou, par sécurité, l'ancien champ "color" (texte)
  const rawColors: unknown[] = Array.isArray(raw.colors) ? raw.colors : raw.color ? [raw.color] : [];
  const colors = [...new Set(rawColors.filter((c): c is ColorName => COLORS.includes(c as ColorName)))];
  if (colors.length > 0) suggestion.colors = colors.slice(0, MAX_COLORS);

  if (raw.pattern === 'uni' || raw.pattern === 'motif') suggestion.pattern = raw.pattern;
  if (Array.isArray(raw.styles)) {
    const valid = raw.styles.filter((s: any) => STYLES.includes(s));
    if (valid.length > 0) suggestion.styles = valid;
  }
  return Object.keys(suggestion).length > 0 ? suggestion : null;
}