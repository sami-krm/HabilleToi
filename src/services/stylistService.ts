import { TYPE_LABELS } from '@/constants/clothing';
import { allColors, type ClothingItem, type Weather } from '@/types';
import { getCloudSession } from '@/services/cloudSync';

const CUSTOM_ENDPOINT = process.env.EXPO_PUBLIC_STYLIST_URL;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const TOKEN = process.env.EXPO_PUBLIC_APP_TOKEN;

export function isStylistConfigured() {
  return Boolean(CUSTOM_ENDPOINT || (SUPABASE_URL && SUPABASE_ANON_KEY));
}

function formatWardrobe(items: ClothingItem[]) {
  return items.slice(0, 120).map((item) => {
    const colors = allColors(item).join(', ');
    const styles = item.styles.join(', ');
    const state = item.clean ? 'propre' : 'sale';
    const waterproof = item.waterproof ? ', imperméable' : '';
    return `- ${TYPE_LABELS[item.type].toLowerCase()} ; ${colors} ; ${styles} ; ${state}${waterproof}`;
  }).join('\n');
}

export async function askStylist(question: string, items: ClothingItem[], weather?: Weather) {
  const usesSupabaseFunction = !CUSTOM_ENDPOINT && Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  const endpoint = CUSTOM_ENDPOINT ?? (usesSupabaseFunction ? `${SUPABASE_URL}/functions/v1/stylist` : undefined);
  if (!endpoint) throw new Error('Assistant non connecté. Une API Gemini sécurisée côté serveur est nécessaire.');
  const wardrobe = formatWardrobe(items);
  const weatherText = weather
    ? `${weather.city ?? 'lieu actuel'}, ${Math.round(weather.minTemperature ?? weather.temperature)}–${Math.round(weather.maxTemperature ?? weather.temperature)} °C, ressenti ${Math.round(weather.apparentTemperature ?? weather.temperature)} °C${weather.rainTime ? `, pluie vers ${weather.rainTime}` : ''}`
    : undefined;

  const session = usesSupabaseFunction ? await getCloudSession() : null;
  if (usesSupabaseFunction && !session) throw new Error('Connecte-toi à la synchronisation en ligne pour utiliser Gemini.');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(usesSupabaseFunction && SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session?.access_token}` } : {}),
      ...(!usesSupabaseFunction && TOKEN ? { 'x-app-token': TOKEN } : {}),
    },
    body: JSON.stringify({ question: question.slice(0, 500), wardrobe, weather: weatherText }),
  });
  if (!response.ok) {
    try {
      const payload = await response.json() as { error?: unknown; message?: unknown };
      const message = typeof payload.error === 'string' ? payload.error : payload.message;
      if (typeof message === 'string') throw new Error(message);
    } catch (e) {
      if (e instanceof Error && !e.message.includes('Unexpected')) throw e;
    }
    throw new Error(`L’assistant ne répond pas (HTTP ${response.status}).`);
  }

  const payload = await response.json() as { answer?: unknown; text?: unknown };
  const answer = typeof payload.answer === 'string' ? payload.answer : payload.text;
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('La réponse de l’assistant est vide.');
  return answer.trim();
}
