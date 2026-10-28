import { getCloudAccessToken } from '@/services/cloudSync';

const PROJECT_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const TIMEOUT_MS = 130_000; // un peu plus que la limite côté serveur

export const areEdgeFunctionsConfigured = () => Boolean(PROJECT_URL && ANON_KEY);

/** Appelle une fonction Supabase avec la session de l'utilisateur ; lève une erreur lisible en cas d'échec. */
export async function callEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!PROJECT_URL || !ANON_KEY) throw new Error('Les fonctions en ligne ne sont pas configurées pour cette version.');
  const accessToken = await getCloudAccessToken();
  // AbortController plutôt qu'AbortSignal.timeout, pas toujours disponible dans React Native
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${PROJECT_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new Error(controller.signal.aborted
      ? 'Le service met trop de temps à répondre. Réessaie dans un instant.'
      : 'Connexion impossible. Vérifie ton accès à Internet.');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    let message = `Erreur serveur (${response.status}).`;
    try {
      const payload = await response.json() as { error?: string };
      if (payload.error) message = payload.error;
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
