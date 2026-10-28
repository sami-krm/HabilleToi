export type ClothingType =
  | 'tshirt' | 'chemise' | 'pull'
  | 'veste' | 'veste_legere' | 'veste_epaisse'
  | 'pantalon' | 'short' | 'jupe' | 'robe' | 'chaussures'
  | 'echarpe' | 'bonnet' | 'parapluie'
  // Accessoires
  | 'sac' | 'ceinture' | 'casquette' | 'lunettes' | 'gants' | 'montre' | 'bijoux';

export type Style = 'sport' | 'casual' | 'formel' | 'soiree';

export type ColorName =
  | 'noir' | 'blanc' | 'gris' | 'beige' | 'marine' | 'marron'
  | 'bleu' | 'rouge' | 'vert' | 'jaune' | 'orange' | 'rose' | 'violet';

export interface ClothingItem {
  id: string;
  uri: string;            // photo (caméra ou galerie)
  type: ClothingType;
  color: ColorName;       // couleur principale
  extraColors?: ColorName[]; // couleurs secondaires (rayures, motifs...) ; absent sur les anciens vêtements
  styles: Style[];        // occasions pour lesquelles il convient
  pattern: 'uni' | 'motif';
  clean: boolean;         // false = au sale, jamais proposé
  sourceUrl?: string;     // adresse de l'image d'origine, pour les vêtements importés depuis une boutique
  price?: number;
  lastWashedAt?: number;
  waterproof?: boolean;
}

/** Toutes les couleurs d'un vêtement, la principale en premier. */
export const allColors = (item: ClothingItem): ColorName[] => [item.color, ...(item.extraColors ?? [])];

export interface Outfit {
  items: ClothingItem[];
  score: number;
  notes: string[];        // ex. « Pas de veste propre disponible »
}

export interface FavoriteOutfit {
  id: string;
  itemIds: string[];
  createdAt: number;
}

export interface Weather {
  temperature: number;    // °C
  precipitation: number;  // mm
  windSpeed: number;      // km/h
  city?: string;          // lieu de la position utilisée
  weatherCode?: number;   // code météo WMO (0 = ciel dégagé, 3 = couvert, 61 = pluie...)
  isDay?: boolean;        // jour ou nuit à cet endroit
  date?: string;
  minTemperature?: number;
  maxTemperature?: number;
  apparentTemperature?: number;
  rainTime?: string;
  latitude?: number;
  longitude?: number;
}

/** Une tenue portée un jour donné (enregistrée dans l'historique). */
export interface WornOutfit {
  id: string;
  itemIds: string[];
  wornAt: number; // horodatage (ms)
  comfort?: 'too_hot' | 'good' | 'too_cold';
}

export type ComfortFeedback = 'too_hot' | 'good' | 'too_cold';
