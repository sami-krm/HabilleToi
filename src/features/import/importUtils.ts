import { File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';

import type { ClothingType, ColorName, Style } from '@/types';
import { classifyProduct, normalize, type ProductKind } from './productRules';

export { normalize };

// ---------- Types ----------
export interface RawItem { name: string; image: string; context?: string }

export interface FoundItem {
  id: string;              // l'URL de l'image sert d'identifiant
  name: string;
  image: string;
  kind: ProductKind;       // vêtement, autre chose, ou pas sûr
  type: ClothingType;      // valeur provisoire tant que typeKnown est faux
  typeKnown: boolean;
  color: ColorName;
  colorKnown: boolean;
  extraColors?: ColorName[];
  pattern?: 'uni' | 'motif';
  styles?: Style[];
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

/** Première estimation d'après le nom ; l'IA l'affine ensuite dans l'écran de résultats. */
export const toFoundItem = (r: RawItem): FoundItem => {
  const guess = classifyProduct(r.name, r.context ?? '');
  return {
    id: r.image,
    name: r.name,
    image: r.image,
    kind: guess.kind,
    type: guess.type ?? 'tshirt',
    typeKnown: guess.type !== undefined,
    color: guess.colors[0] ?? 'gris',
    colorKnown: guess.colors.length > 0,
    extraColors: guess.colors.slice(1),
  };
};

// ---------- Script injecté dans la page de la boutique ----------
// Lit les images d'articles visibles sur la page, avec le nom et le texte du bloc qui les entoure.
export const EXTRACT_SCRIPT = `
(function () {
  try {
    var seen = {};
    var items = [];
    var BAD = new RegExp('qr|barcode|app-?store|google-?play|download|telecharg|badge|logo|icon|sprite|flag|banner|payment|avatar|pixel|tracking|placeholder|loader|spinner|rating|trustpilot|facebook|instagram|twitter|pinterest|youtube|tiktok|visa|mastercard|paypal|klarna|delivery|livraison|carrier', 'i');
    document.querySelectorAll('img').forEach(function (img) {
      var src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
      if (!src || src.indexOf('data:') === 0) return;
      if (src.indexOf('.svg') !== -1) return;
      if (img.closest('header, nav, footer')) return;
      var rect = img.getBoundingClientRect();
      var w = rect.width || img.naturalWidth || 0;
      var h = rect.height || img.naturalHeight || 0;
      if (w < 70 || h < 70) return;
      var ratio = w / h;
      if (ratio < 0.5 || ratio > 1.8) return;
      if (BAD.test(src + ' ' + (img.alt || ''))) return;
      if (seen[src]) return;
      seen[src] = true;
      var box = img;
      for (var i = 0; i < 6 && box.parentElement; i++) {
        var p = box.parentElement;
        if (p.querySelectorAll('img').length > 1) break;
        box = p;
      }
      var context = (box.innerText || '').split(/\\s+/).join(' ').slice(0, 200);
      var name = (img.alt || img.title || '').trim();
      if (name.length < 4) name = context.slice(0, 90);
      items.push({ name: name || 'Article', image: src, context: context });
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

/** Télécharge une image distante et la renvoie en base64, prête à être envoyée à l'IA. */
export async function urlToBase64(url: string): Promise<{ base64: string; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image : HTTP ${res.status}`);
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Lecture de l\'image impossible'));
    reader.readAsDataURL(blob);
  });
  const [head, data] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
  return { base64: data, mime };
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