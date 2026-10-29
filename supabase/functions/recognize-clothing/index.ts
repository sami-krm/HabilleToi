// @ts-nocheck
// Reconnaît un seul vêtement (ou accessoire) sur une photo : type, couleurs, motif, occasions.
// Avec « name », sert aussi à vérifier qu'un article importé d'une boutique est bien un vêtement.
import { cleanColors, cleanStyles, COLORS, parseJsonObject, STYLES, TYPE_HINT, TYPES } from '../_shared/catalog.ts';
import { callGemini, cors, json, readImage, requireUser, textOf } from '../_shared/gemini.ts';

const prompt = (name?: string) => `Tu analyses la photo d'un article${name ? ` vendu sous le nom « ${name} »` : ''}.
Réponds uniquement avec un objet JSON valide, sans texte autour ni balises de code, de la forme :
{"clothing":true,"type":"…","colors":["…"],"pattern":"uni|motif","styles":["…"]}
- clothing : false si ce n'est ni un vêtement ni un accessoire porté (parfum, QR code, décor...).
- type parmi : ${TYPES.join(', ')} (${TYPE_HINT}).
- colors : 1 à 3 couleurs parmi ${COLORS.join(', ')}, la dominante en premier.
- styles : 1 à 3 occasions parmi ${STYLES.join(', ')}.
S'il y a plusieurs pièces, décris la pièce principale, la plus visible.`;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const denied = await requireUser(request);
  if (denied) return denied;
  const { body, image, error } = await readImage(request);
  if (error) return error;
  const name = typeof body.name === 'string' ? body.name.slice(0, 200) : undefined;

  // Flash-Lite : gratuit et rapide (environ 2 s) ; les autres modèles servent de secours
  const models = [Deno.env.get('GEMINI_RECOGNITION_MODEL') ?? 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'];
  let lastError = 'Reconnaissance illisible, réessaie.';
  for (const model of [...new Set(models)]) {
    let blocks;
    try {
      blocks = await callGemini([model], [{ type: 'text', text: prompt(name) }, { type: 'image', ...image }], { thinking_level: 'low', temperature: 0.2 });
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Reconnaissance indisponible.';
      continue;
    }
    const raw = parseJsonObject(textOf(blocks));
    if (!raw) {
      console.error(`Réponse illisible de ${model} : ${textOf(blocks).slice(0, 400)}`);
      continue;
    }
    if (raw.clothing === false) return json({ clothing: false });
    return json({
      clothing: true,
      ...(TYPES.includes(raw.type) ? { type: raw.type } : {}),
      colors: cleanColors(raw.colors),
      ...(raw.pattern === 'uni' || raw.pattern === 'motif' ? { pattern: raw.pattern } : {}),
      styles: cleanStyles(raw.styles),
    });
  }
  return json({ error: lastError }, 502);
});
