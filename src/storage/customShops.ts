import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Shop } from '@/features/onboarding/profile';

const CUSTOM_SHOPS_KEY = '@app/custom-shops';

export async function loadCustomShops(): Promise<Shop[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_SHOPS_KEY);
    return raw ? (JSON.parse(raw) as Shop[]) : [];
  } catch {
    return [];
  }
}

export const saveCustomShops = (shops: Shop[]) => AsyncStorage.setItem(CUSTOM_SHOPS_KEY, JSON.stringify(shops));

/**
 * Transforme ce que l'utilisateur a tapé (« monsite.fr », « https://www.monsite.fr/compte »...) en boutique.
 * Renvoie null si ce n'est pas une adresse de site valable.
 */
export function shopFromInput(input: string, name?: string): Shop | null {
  const text = input.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  const domain = host.replace(/^www\./, '');
  // Nom par défaut : « monsite.fr » → « Monsite »
  const fallback = domain.split('.')[0];
  return {
    id: `custom-${domain}`,
    name: name?.trim() || fallback.charAt(0).toUpperCase() + fallback.slice(1),
    domain,
    url: `https://${host}${url.pathname === '/' ? '' : url.pathname}`,
  };
}

/** Vrai si le site répond : écarte les fautes de frappe (« monsite.frr », adresse collée deux fois...). */
export async function siteExists(shop: Shop, timeoutMs = 8000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // N'importe quelle réponse, même une erreur 403 d'un site qui bloque les robots, prouve que le site existe
    await fetch(shop.url, { method: 'GET', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
