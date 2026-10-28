import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { ClothingItem } from '@/types';

export interface Backup { format: 'tenue-du-jour'; version: 1; createdAt: string; storage: [string, string][]; photos: Record<string, string> }

async function buildBackup(): Promise<Backup> {
  const keys = await AsyncStorage.getAllKeys();
  const storage = (await AsyncStorage.multiGet(keys)).reduce<[string, string][]>((acc, [key, value]) => {
    if (value !== null) acc.push([key, value]);
    return acc;
  }, []);
  const photos: Record<string, string> = {};
  const rawWardrobe = storage.find(([key]) => key === '@wardrobe/items')?.[1];
  const items = rawWardrobe ? JSON.parse(rawWardrobe) as ClothingItem[] : [];
  for (const item of items) {
    try { if (item.uri.startsWith('file://')) photos[item.id] = await new File(item.uri).base64(); } catch {}
  }
  const profileJson = storage.find(([key]) => key === 'profile')?.[1];
  if (profileJson) {
    try { const avatar = (JSON.parse(profileJson) as { avatar?: string }).avatar; if (avatar?.startsWith('file://')) photos['profile-avatar'] = await new File(avatar).base64(); } catch {}
  }
  return { format: 'tenue-du-jour', version: 1, createdAt: new Date().toISOString(), storage, photos };
}

export async function createBackupString(): Promise<string> {
  return JSON.stringify(await buildBackup());
}

export async function exportBackup(): Promise<string> {
  const serialized = await createBackupString();
  const name = `tenue-du-jour-${Date.now()}.json`;
  let file: File;
  if (Platform.OS === 'android') {
    const directory = await Directory.pickDirectoryAsync();
    file = directory.createFile(name, 'application/json');
  } else {
    file = new File(Paths.document, name);
    file.create({ intermediates: true, overwrite: true });
  }
  file.write(serialized);
  return file.uri;
}

export async function restoreBackupString(serialized: string): Promise<number> {
  const backup = JSON.parse(serialized) as Partial<Backup>;
  if (backup.format !== 'tenue-du-jour' || backup.version !== 1 || !Array.isArray(backup.storage)) {
    throw new Error('Ce fichier ne ressemble pas à une sauvegarde Tenue du jour.');
  }
  const photoUris = new Map<string, string>();
  for (const [id, base64] of Object.entries(backup.photos ?? {})) {
    const image = new File(Paths.document, `restored-${id.replace(/[^a-zA-Z0-9_-]/g, '')}.jpg`);
    image.create({ intermediates: true, overwrite: true });
    image.write(base64, { encoding: 'base64' });
    photoUris.set(id, image.uri);
  }
  const values = backup.storage.map(([key, value]) => {
    if (!value) return [key, value] as [string, string];
    if (key === '@wardrobe/items') {
      const items = JSON.parse(value) as ClothingItem[];
      return [key, JSON.stringify(items.map((item) => ({ ...item, uri: photoUris.get(item.id) ?? item.uri })))] as [string, string];
    }
    if (key === 'profile' && photoUris.has('profile-avatar')) {
      return [key, JSON.stringify({ ...JSON.parse(value), avatar: photoUris.get('profile-avatar') })] as [string, string];
    }
    return [key, value] as [string, string];
  });
  await AsyncStorage.multiSet(values);
  return values.length;
}

export async function importBackup(): Promise<number> {
  const selected = await File.pickFileAsync({ mimeTypes: ['application/json'] });
  if (selected.canceled || !selected.result) return 0;
  return restoreBackupString(await selected.result.text());
}

export async function clearUserData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const items = await AsyncStorage.getItem('@wardrobe/items');
  if (items) {
    for (const item of JSON.parse(items) as ClothingItem[]) {
      try { if (item.uri.startsWith(Paths.document.uri)) { const image = new File(item.uri); if (image.exists) image.delete(); } } catch {}
    }
  }
  try {
    const profile = await AsyncStorage.getItem('profile');
    const avatar = profile ? (JSON.parse(profile) as { avatar?: string }).avatar : undefined;
    if (avatar?.startsWith(Paths.document.uri)) { const image = new File(avatar); if (image.exists) image.delete(); }
  } catch {}
  await AsyncStorage.multiRemove(keys.filter((key) => !key.startsWith('expo-')));
}
