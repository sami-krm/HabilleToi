import { File } from 'expo-file-system';
import { callEdgeFunction } from '@/services/edgeFunctions';

export async function removeClothingBackground(imageUri: string): Promise<string> {
  const imageBase64 = await new File(imageUri).base64();
  const payload = await callEdgeFunction<{ imageBase64?: string }>('remove-background', { imageBase64 });
  if (!payload.imageBase64) throw new Error('Le service n’a pas renvoyé d’image détourée.');
  return payload.imageBase64;
}
