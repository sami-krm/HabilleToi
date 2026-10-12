import { File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';

import type { ClothingType, ColorName } from '@/types';

// ---------- Types ----------
export interface RawItem { name: string; image: string }
export interface FoundItem {
  id: string;        // l'URL de l'image sert d'identifiant
  name: string;
  image: string;
  type: ClothingType;
  color: ColorName;
}

export const TYPE_LABELS: Record<ClothingType, string> = {
  tshirt: 'T-shirt', chemise: 'Chemise', pull: 'Pull', veste: 'Veste',
  pantalon: 'Pantalon', short: 'Short', chaussures: 'Chaussures',
};
export const TYPE_ORDER = Object.keys(TYPE_LABELS) as ClothingType[];

export const COLOR_HEX: Record<ColorName, string> = {
  noir: '#111111', blanc: '#FFFFFF', gris: '#9E9E9E', beige: '#D8C3A5',
  marine: '#1F2A44', marron: '#6B4423', bleu: '#2F6FED', rouge: '#D32F2F',
  vert: '#2E8B57', jaune: '#F4C430', orange: '#F57C00', rose: '#F48FB1', violet: '#7E57C2',
};
export const COLOR_ORDER = Object.keys(COLOR_HEX) as ColorName[];

// ---------- Déduction du type et de la couleur d'après le nom ----------
export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// L'ordre compte : on teste les cas les plus spécifiques d'abord
const TYPE_KEYWORDS: [ClothingType, string[]][] = [
  ['chaussures', ['chaussure', 'basket', 'sneaker', 'botte', 'bottine', 'sandale', 'mocassin', 'derby']],
  ['short', ['short', 'bermuda']],
  ['pantalon', ['pantalon', 'jean', 'chino', 'jogging', 'jogger', 'legging', 'cargo']],
  ['veste', ['veste', 'manteau', 'blouson', 'parka', 'doudoune', 'trench', 'imper', 'coupe-vent']],
  ['pull', ['pull', 'sweat', 'hoodie', 'gilet', 'cardigan', 'maille', 'col roule']],
  ['chemise', ['chemise', 'blouse', 'overshirt']],
  ['tshirt', ['t-shirt', 'tee-shirt', 'tee shirt', 'tshirt', 'debardeur', 'polo']],
];

const COLOR_KEYWORDS: [ColorName, string[]][] = [
  ['marine', ['marine', 'navy', 'bleu nuit']],
  ['noir', ['noir', 'black']],
  ['blanc', ['blanc', 'white']],
  ['gris', ['gris', 'grey', 'gray', 'anthracite', 'chine']],
  ['beige', ['beige', 'ecru', 'sable', 'camel', 'creme', 'nude']],
  ['marron', ['marron', 'brun', 'chocolat', 'brown', 'taupe']],
  ['bleu', ['bleu', 'blue', 'denim', 'indigo']],
  ['rouge', ['rouge', 'red', 'bordeaux', 'burgundy']],
  ['vert', ['vert', 'green', 'kaki', 'olive', 'sauge']],
  ['jaune', ['jaune', 'yellow', 'moutarde']],
  ['orange', ['orange', 'corail', 'terracotta']],
  ['rose', ['rose', 'pink', 'fuchsia']],
  ['violet', ['violet', 'purple', 'lilas', 'mauve', 'prune']],
];

export function guessType(name: string): ClothingType {
  const text = normalize(name);
  for (const [type, words] of TYPE_KEYWORDS) {
    if (words.some((w) => text.includes(w))) return type;
  }
  return 'tshirt';
}

export function guessColor(name: string): ColorName {
  const text = normalize(name);
  for (const [color, words] of COLOR_KEYWORDS) {
    if (words.some((w) => text.includes(w))) return color;
  }
  return 'gris'; // couleur neutre par défaut
}

export const toFoundItem = (r: RawItem): FoundItem => ({
  id: r.image, name: r.name, image: r.image, type: guessType(r.name), color: guessColor(r.name),
});

// ---------- Script injecté dans la page de la boutique ----------
// Lit les images d'articles visibles sur la page et renvoie leur nom (attribut alt ou texte voisin).
export const EXTRACT_SCRIPT = `
(function () {
  try {
    var seen = {};
    var items = [];
    document.querySelectorAll('img').forEach(function (img) {
      var src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
      if (!src || src.indexOf('data:') === 0) return;
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      if (w < 60 || h < 60) return;
      var meta = (src + ' ' + (img.alt || '')).toLowerCase();
      if (/logo|icon|sprite|flag|banner|payment|badge|avatar/.test(meta)) return;
      if (/\\.svg(\\?|$)/.test(src)) return;
      if (seen[src]) return;
      seen[src] = true;
      var name = (img.alt || '').trim();
      if (!name) {
        var box = img.closest('li, article, tr, div');
        if (box) name = (box.innerText || '').trim().split('\\n')[0].slice(0, 80);
      }
      items.push({ name: name || 'Article', image: src });
    });
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'items', items: items.slice(0, 150) }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: String(e) }));
  }
})();
true;
`;

// ---------- Images ----------
/** Copie l'image dans le stockage de l'app ; garde l'URL distante si le téléchargement échoue. */
export async function storeImage(url: string, id: string): Promise<string> {
  try {
    const file = await File.downloadFileAsync(url, new File(Paths.document, `${id}.jpg`));
    return file.uri;
  } catch {
    return url;
  }
}

// ---------- Notification de fin d'import ----------
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function notifyImportDone(count: number): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Import terminé',
        body: `${count} vêtement${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''} à ton dressing.`,
      },
      trigger: null, // immédiate
    });
  } catch {
    // notification non essentielle : on ignore l'échec
  }
}