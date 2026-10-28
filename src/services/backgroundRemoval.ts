import { File } from 'expo-file-system';
import { getCloudAccessToken } from '@/services/cloudSync';

const PROJECT_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export async function removeClothingBackground(imageUri: string): Promise<string> {
  if (!PROJECT_URL || !ANON_KEY) {
    throw new Error('La fonction de détourage Supabase n’est pas configurée pour cette version.');
  }

  const accessToken = await getCloudAccessToken();
  const imageBase64 = await new File(imageUri).base64();
  const response = await fetch(`${PROJECT_URL}/functions/v1/remove-background`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ imageBase64 }),
  });

  if (!response.ok) {
    let message = `Erreur serveur (${response.status}).`;
    try {
      const payload = await response.json() as { error?: string };
      if (payload.error) message = payload.error;
    } catch {}
    throw new Error(message);
  }

  const payload = await response.json() as { imageBase64?: string };
  if (!payload.imageBase64) throw new Error('Le service n’a pas renvoyé d’image détourée.');
  return payload.imageBase64;
}
