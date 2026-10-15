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

const safeMedia = (m: string) => (MEDIA_TYPES.includes(m) ? m : 'image/jpeg');

/** Lit le JSON renvoyé par l'IA (tolère du texte autour) ; null si illisible. */
function parseJson(text: string): any | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/** Ne garde que des valeurs reconnues par l'app ; null si rien d'exploitable (= pas un vêtement). */
function toSuggestion(raw: any): Suggestion | null {
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

/**
 * Envoie la photo d'un vêtement au Worker et renvoie une suggestion validée.
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
    body: JSON.stringify({ imageBase64, mediaType: safeMedia(mediaType) }),
  });
  if (!res.ok) throw new Error(`Reconnaissance : HTTP ${res.status} ${await res.text()}`);

  const { text } = (await res.json()) as { text: string };
  const raw = parseJson(text);
  return raw ? toSuggestion(raw) : null;
}

// ---------- Vérification d'un article importé d'une boutique ----------
export type ProductVerdict =
  | { status: 'unavailable' }                    // Worker non configuré
  | { status: 'rate-limited' }                   // limite gratuite atteinte
  | { status: 'failed' }                         // erreur ponctuelle
  | { status: 'not-clothing' }                   // sac, parfum, QR code...
  | { status: 'clothing'; suggestion: Suggestion };

/** Demande à l'IA si le produit (photo + nom) est un vêtement, et lequel. */
export async function analyzeProduct(
  imageBase64: string,
  mediaType: string,
  name: string,
): Promise<ProductVerdict> {
  if (!ENDPOINT || !TOKEN) return { status: 'unavailable' };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-token': TOKEN },
      body: JSON.stringify({ imageBase64, mediaType: safeMedia(mediaType), name: name.slice(0, 200) }),
    });
  } catch {
    return { status: 'failed' };
  }
  if (res.status === 429) return { status: 'rate-limited' };
  if (!res.ok) return { status: 'failed' };

  try {
    const { text } = (await res.json()) as { text: string };
    const raw = parseJson(text);
    if (!raw) return { status: 'failed' };
    const suggestion = toSuggestion(raw);
    return suggestion ? { status: 'clothing', suggestion } : { status: 'not-clothing' };
  } catch {
    return { status: 'failed' };
  }
}