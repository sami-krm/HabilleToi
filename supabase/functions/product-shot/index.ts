// @ts-nocheck
// Transforme la photo d'un vêtement (seul ou porté) en photo « boutique » : pièce seule, fond clair.
import { callGemini, cors, imageOf, json, readImage, requireUser } from '../_shared/gemini.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const denied = await requireUser(request);
  if (denied) return denied;
  const { body, image, error } = await readImage(request);
  if (error) return error;

  const description = typeof body.description === 'string' ? body.description.slice(0, 120) : 'le vêtement';
  const box = Array.isArray(body.box) && body.box.length === 4 ? body.box.map(Number) : null;
  const where = box ? ` Il se trouve dans la zone [ymin, xmin, ymax, xmax] = [${box.join(', ')}] (coordonnées sur 1000).` : '';

  const prompt = `Crée la photo produit e-commerce de cet article : ${description}.${where}
Montre uniquement cet article, seul, de face, centré, à plat ou sur un mannequin invisible, comme sur un site de vente en ligne.
Fond uni gris très clair (#F2F2F4), éclairage studio doux, légère ombre portée.
Garde exactement les couleurs, la matière, les motifs, les logos et les détails de l'article d'origine.
Aucune personne, aucune main, aucun autre vêtement, aucun texte. Format carré.`;

  let blocks;
  try {
    blocks = await callGemini(
      [Deno.env.get('GEMINI_IMAGE_MODEL') ?? 'gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image', 'gemini-nano-banana-2.1'],
      [{ type: 'text', text: prompt }, { type: 'image', ...image }],
    );
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Création de la photo indisponible.' }, 502);
  }
  const result = imageOf(blocks);
  if (!result) return json({ error: 'Aucune image n’a été générée.' }, 502);
  return json({ imageBase64: result.data, mediaType: result.mime_type ?? 'image/png' });
});
