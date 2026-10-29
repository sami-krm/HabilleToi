import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ClipOp, ImageFormat, Skia } from '@shopify/react-native-skia';

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
  /** Contour exact de la pièce : polygone [x, y] sur 1000, coordonnées de l'image entière. */
  mask?: [number, number][];
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

/**
 * Vrai si le contour semble fiable : assez rempli (pas une forme en zigzag) et
 * placé au même endroit que le cadre de la pièce quand on le connaît.
 */
export function isUsableMask(mask: [number, number][], box?: DetectedPiece['box']): boolean {
  if (mask.length < 6) return false;
  const xs = mask.map((p) => p[0]);
  const ys = mask.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const boundsArea = (x1 - x0) * (y1 - y0);
  if (boundsArea < 400) return false;
  // Aire du polygone (formule du lacet)
  let area = 0;
  mask.forEach(([x, y], i) => {
    const [nx, ny] = mask[(i + 1) % mask.length];
    area += x * ny - nx * y;
  });
  if (Math.abs(area) / 2 < boundsArea * 0.4) return false;
  if (!box) return true;
  const [by0, bx0, by1, bx1] = box;
  const inter = Math.max(0, Math.min(x1, bx1) - Math.max(x0, bx0)) * Math.max(0, Math.min(y1, by1) - Math.max(y0, by0));
  const union = boundsArea + (bx1 - bx0) * (by1 - by0) - inter;
  return union > 0 && inter / union >= 0.6;
}

/**
 * Détoure une pièce le long de son contour, sur le téléphone (Skia) : fond transparent,
 * image recadrée autour de la pièce. Renvoie l'adresse du PNG créé.
 */
export function cutoutPiece(imageBase64: string, mask: [number, number][]): string {
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(imageBase64));
  if (!image) throw new Error('Photo illisible.');
  const w = image.width();
  const h = image.height();
  const points = mask.map(([x, y]) => [(x / 1000) * w, (y / 1000) * h] as const);

  // Cadre autour du contour, avec une petite marge
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const margin = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.04;
  const left = Math.max(0, Math.floor(Math.min(...xs) - margin));
  const top = Math.max(0, Math.floor(Math.min(...ys) - margin));
  const width = Math.min(w, Math.ceil(Math.max(...xs) + margin)) - left;
  const height = Math.min(h, Math.ceil(Math.max(...ys) + margin)) - top;
  if (width < 8 || height < 8) throw new Error('Zone trop petite pour être détourée.');

  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) throw new Error('Détourage impossible sur cet appareil.');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));

  const path = Skia.Path.Make();
  points.forEach(([x, y], i) => (i === 0 ? path.moveTo(x - left, y - top) : path.lineTo(x - left, y - top)));
  path.close();
  canvas.clipPath(path, ClipOp.Intersect, true);
  canvas.drawImageRect(image, Skia.XYWHRect(left, top, width, height), Skia.XYWHRect(0, 0, width, height), Skia.Paint());
  surface.flush();

  const result = surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG);
  const file = new File(Paths.cache, `piece-${Date.now()}-${Math.round(Math.random() * 1e6)}.png`);
  file.create({ intermediates: true, overwrite: true });
  file.write(result, { encoding: 'base64' });
  return file.uri;
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
