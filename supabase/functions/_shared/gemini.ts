// @ts-nocheck
// Outils communs aux fonctions qui appellent Gemini : CORS, session Supabase, appel de l'API Interactions.

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

/** Vérifie la session Supabase de l'appelant ; renvoie une réponse d'erreur si elle manque. */
export async function requireUser(request: Request): Promise<Response | null> {
  const authorization = request.headers.get('Authorization');
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization?.startsWith('Bearer ') || !projectUrl || !anonKey) {
    return json({ error: 'Connecte-toi à ton compte pour utiliser cette fonction.' }, 401);
  }
  const user = await fetch(`${projectUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
  return user.ok ? null : json({ error: 'Ta session a expiré. Reconnecte-toi.' }, 401);
}

/** Lit { imageBase64, mediaType } dans la requête, avec une taille raisonnable. */
export async function readImage(request: Request) {
  let body;
  try { body = await request.json(); } catch { return { error: json({ error: 'Requête invalide.' }, 400) }; }
  const { imageBase64, mediaType } = body ?? {};
  if (typeof imageBase64 !== 'string' || !imageBase64 || imageBase64.length > 14_000_000) {
    return { error: json({ error: 'Image invalide ou trop volumineuse.' }, 413) };
  }
  const mime = ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg';
  return { body, image: { data: imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), mime_type: mime } };
}

const TOTAL_BUDGET_MS = 120_000; // Supabase coupe une fonction à 150 s : on s'arrête avant
const ATTEMPT_TIMEOUT_MS = 60_000;
// Erreurs passagères côté Google (surcharge, quota, panne) : on essaie le modèle suivant
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * Appelle l'API Interactions de Gemini et renvoie les blocs produits par le modèle.
 * Si un modèle est surchargé, on passe au suivant de la liste.
 */
export async function callGemini(models: string[], input: unknown[], generationConfig?: Record<string, unknown>) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY manquante côté serveur.');
  const started = Date.now();
  let overloaded = false;
  let notInPlan = false; // modèle exclu de l'offre gratuite de Google (quota à 0)

  for (const model of [...new Set(models.filter(Boolean))]) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining < 5_000) break;
    const attemptStart = Date.now();
    let response: Response;
    try {
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ model, input, store: false, ...(generationConfig ? { generation_config: generationConfig } : {}) }),
        signal: AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, remaining)),
      });
    } catch (e) {
      console.error(`Gemini (${model}) sans réponse après ${Date.now() - attemptStart} ms :`, e);
      overloaded = true;
      continue;
    }
    console.log(`Gemini (${model}) a répondu ${response.status} en ${Date.now() - attemptStart} ms`);
    if (response.ok) {
      const result = await response.json();
      return (result.steps ?? [])
        .filter((step) => step.type === 'model_output')
        .flatMap((step) => step.content ?? []);
    }
    // Le détail de Gemini aide à comprendre un refus (modèle inconnu, champ invalide...)
    const detail = await response.text().catch(() => '');
    console.error(`Gemini ${response.status} (${model}) : ${detail.slice(0, 1000)}`);
    if (response.status === 429 && /limit: 0 /.test(detail)) { notInPlan = true; continue; }
    if (RETRYABLE.has(response.status)) { overloaded = true; continue; }
    let message = '';
    try { message = JSON.parse(detail)?.error?.message ?? ''; } catch {}
    throw new Error(`Gemini a refusé la demande (${response.status})${message ? ` : ${message.slice(0, 200)}` : '.'}`);
  }
  if (notInPlan && !overloaded) {
    throw new Error('Ce service Gemini n’est pas inclus dans l’offre gratuite : active la facturation sur Google AI Studio.');
  }
  throw new Error(overloaded
    ? 'Gemini est très demandé en ce moment. Réessaie dans quelques minutes.'
    : 'Aucun modèle Gemini disponible.');
}

export const textOf = (blocks) => blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();

export const imageOf = (blocks) => blocks.filter((b) => b.type === 'image' && b.data).pop();
