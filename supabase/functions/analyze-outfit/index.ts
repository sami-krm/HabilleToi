// @ts-nocheck
// Repère chaque vêtement et accessoire porté sur une photo de tenue, avec sa position.
import { cleanColors, cleanStyles, COLORS, parseJsonObject, STYLES, TYPE_HINT, TYPES } from '../_shared/catalog.ts';
import { callGemini, cors, json, readImage, requireUser, textOf } from '../_shared/gemini.ts';

const PROMPT = `Tu analyses la photo d'une tenue portée. Repère chaque vêtement et accessoire visible
(un seul élément par pièce, ignore la peau, les cheveux et le décor).
Réponds uniquement avec un objet JSON valide, sans texte autour ni balises de code, de la forme :
{"items":[{"type":"…","label":"…","colors":["…"],"pattern":"uni|motif","styles":["…"],"box_2d":[ymin,xmin,ymax,xmax],"mask":[[x,y],[x,y],…]}]}
- type parmi : ${TYPES.join(', ')} (${TYPE_HINT}).
- label : description courte en français (ex. « pull col rond en maille vert kaki »).
- colors : 1 à 3 couleurs parmi ${COLORS.join(', ')}, la dominante en premier.
- styles : 1 à 3 occasions parmi ${STYLES.join(', ')}.
- box_2d : position de la pièce, coordonnées normalisées de 0 à 1000.
- mask : contour précis de la pièce seule (sans la peau ni les autres vêtements qui la recouvrent), polygone de 12 à 60 points [x, y] dans l'ordre, coordonnées de l'image entière normalisées de 0 à 1000.
Au plus 8 pièces. Si ce n'est pas une photo de tenue, renvoie {"items":[]}.`;

/** Extrait { items: [...] } du texte. */
function parseItems(text: string) {
  const value = parseJsonObject(text);
  if (Array.isArray(value?.items)) return value;
  if (Array.isArray(value)) return { items: value };
  return null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const denied = await requireUser(request);
  if (denied) return denied;
  const { image, error } = await readImage(request);
  if (error) return error;

  // Flash-Lite d'abord : rapide (2 s) et assez précis pour repérer les pièces.
  // Si un modèle renvoie un texte illisible, on essaie le suivant.
  const models = [Deno.env.get('GEMINI_VISION_MODEL') ?? 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'];
  let parsed = null;
  let lastError = 'Analyse illisible, réessaie.';
  for (const model of [...new Set(models)]) {
    let blocks;
    try {
      blocks = await callGemini([model], [{ type: 'text', text: PROMPT }, { type: 'image', ...image }], { thinking_level: 'low', temperature: 0.2 });
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Analyse indisponible.';
      continue;
    }
    const text = textOf(blocks);
    parsed = parseItems(text);
    if (parsed) break;
    console.error(`Réponse illisible de ${model} : ${text.slice(0, 600) || '(vide)'} | blocs : ${JSON.stringify(blocks.map((b) => b.type))}`);
  }
  if (!parsed) return json({ error: lastError }, 502);

  // On ne garde que des valeurs connues de l'app
  const items = parsed.items.slice(0, 8).flatMap((raw) => {
    if (!TYPES.includes(raw?.type)) return [];
    const colors = cleanColors(raw.colors);
    const styles = cleanStyles(raw.styles);
    const box = Array.isArray(raw.box_2d) && raw.box_2d.length === 4 && raw.box_2d.every((n) => typeof n === 'number')
      ? raw.box_2d.map((n) => Math.min(1000, Math.max(0, n)))
      : undefined;
    // Contour : au moins 3 points valides, sinon la pièce sera découpée en rectangle
    const mask = Array.isArray(raw.mask)
      ? raw.mask
        .filter((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n)))
        .slice(0, 200)
        .map(([x, y]) => [Math.min(1000, Math.max(0, x)), Math.min(1000, Math.max(0, y))])
      : [];
    return [{
      type: raw.type,
      label: typeof raw.label === 'string' ? raw.label.slice(0, 80) : raw.type,
      colors: colors.length ? colors : ['gris'],
      pattern: raw.pattern === 'motif' ? 'motif' : 'uni',
      styles: styles.length ? styles : ['casual'],
      box,
      ...(mask.length >= 3 ? { mask } : {}),
    }];
  });
  return json({ items });
});
