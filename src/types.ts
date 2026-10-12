export type ClothingType =
  | 'tshirt' | 'chemise' | 'pull' | 'veste' | 'pantalon' | 'short' | 'chaussures';

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

}

/** Une tenue portée un jour donné (enregistrée dans l'historique). */
export interface WornOutfit {
  id: string;
  itemIds: string[];
  wornAt: number; // horodatage (ms)
}