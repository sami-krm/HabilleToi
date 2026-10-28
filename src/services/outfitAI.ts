import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { TYPE_LABELS } from '@/constants/clothing';
import { callEdgeFunction } from '@/services/edgeFunctions';
import type { ClothingType, ColorName, Style } from '@/types';

/** Une pièce repérée sur une photo de tenue. */
export interface DetectedPiece {
  type: ClothingType;
  label: string;
  colors: ColorName[];
  pattern: 'uni' | 'motif';
  styles: Style[];
  /** [ymin, xmin, ymax, xmax] sur 1000, pour aider la création de la photo boutique. */
  box?: [number, number, number, number];
}

/** Repère les vêtements et accessoires d'une photo de tenue portée. */
export async function analyzeOutfitPhoto(imageBase64: string, mediaType: string): Promise<DetectedPiece[]> {
  const { items } = await callEdgeFunction<{ items: DetectedPiece[] }>('analyze-outfit', { imageBase64, mediaType });
  return items;
}

const CROP_MARGIN = 0.08; // marge autour de la pièce, en proportion de sa taille

/**
 * Découpe une pièce dans la photo de tenue, sur le téléphone (gratuit, sans envoi).
 * La position vient de la détection : [ymin, xmin, ymax, xmax] sur 1000.
 */
export async function cropPiece(uri: string, imageWidth: number, imageHeight: number, box: NonNullable<DetectedPiece['box']>): Promise<string> {
  const [ymin, xmin, ymax, xmax] = box;
  const marginX = (xmax - xmin) * CROP_MARGIN;
  const marginY = (ymax - ymin) * CROP_MARGIN;
  const left = Math.max(0, ((xmin - marginX) / 1000) * imageWidth);
  const top = Math.max(0, ((ymin - marginY) / 1000) * imageHeight);
  const right = Math.min(imageWidth, ((xmax + marginX) / 1000) * imageWidth);
  const bottom = Math.min(imageHeight, ((ymax + marginY) / 1000) * imageHeight);
  if (right - left < 8 || bottom - top < 8) throw new Error('Zone trop petite pour être découpée.');

  const context = ImageManipulator.manipulate(uri);
  context.crop({ originX: Math.round(left), originY: Math.round(top), width: Math.round(right - left), height: Math.round(bottom - top) });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return result.uri;
}

/** Description courte envoyée au générateur, ex. « Pull vert à motifs ». */
export const describePiece = (type: ClothingType, colors: ColorName[], pattern: 'uni' | 'motif') =>
  `${TYPE_LABELS[type]} ${colors.join(' et ')}${pattern === 'motif' ? ' à motifs' : ''}`;

/**
 * Crée une photo « boutique » de la pièce (seule, fond clair) et l'enregistre dans le cache.
 * Renvoie l'adresse du fichier créé. Payant : la génération d'images n'est pas dans l'offre gratuite de Gemini.
 */
export async function createProductShot(
  imageBase64: string,
  mediaType: string,
  description: string,
  box?: DetectedPiece['box'],
): Promise<string> {
  const result = await callEdgeFunction<{ imageBase64?: string; mediaType?: string }>(
    'product-shot', { imageBase64, mediaType, description, box },
  );
  if (!result.imageBase64) throw new Error('Aucune photo boutique n’a été créée.');
  const extension = result.mediaType === 'image/jpeg' ? 'jpg' : 'png';
  const file = new File(Paths.cache, `boutique-${Date.now()}-${Math.round(Math.random() * 1e6)}.${extension}`);
  file.create({ intermediates: true, overwrite: true });
  file.write(result.imageBase64, { encoding: 'base64' });
  return file.uri;
}
