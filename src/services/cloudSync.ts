import * as SecureStore from 'expo-secure-store';
import { createBackupString, restoreBackupString } from '@/services/backupService';

const PROJECT_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SESSION_KEY = 'supabase-session';
const BUCKET = 'wardrobe-backups';

export interface CloudSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
}

interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string };
  msg?: string;
  message?: string;
  error_description?: string;
}

export const isCloudSyncConfigured = () => Boolean(PROJECT_URL && ANON_KEY);

function requireConfig() {
  if (!PROJECT_URL || !ANON_KEY) throw new Error('La synchronisation en ligne n’est pas configurée pour cette version.');
  return { projectUrl: PROJECT_URL, anonKey: ANON_KEY };
}

async function errorMessage(response: Response) {
  try {
    const payload = await response.json() as AuthResponse;
    return payload.msg ?? payload.message ?? payload.error_description ?? `Erreur serveur (${response.status}).`;
  } catch {
    return `Erreur serveur (${response.status}).`;
  }
}

function makeSession(response: AuthResponse): CloudSession {
  if (!response.access_token || !response.refresh_token || !response.user?.id) {
    throw new Error('Compte créé. Vérifie ton adresse e-mail, puis connecte-toi.');
  }
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: Date.now() + (response.expires_in ?? 3600) * 1000,
    user: { id: response.user.id, email: response.user.email },
  };
}

async function saveSession(session: CloudSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

async function readSavedSession(): Promise<CloudSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as CloudSession; } catch { return null; }
}

async function authRequest(path: string, body: Record<string, string>) {
  const { projectUrl, anonKey } = requireConfig();
  const response = await fetch(`${projectUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<AuthResponse>;
}

export async function createCloudAccount(email: string, password: string) {
  const response = await authRequest('signup', { email: email.trim(), password });
  if (!response.access_token) return null;
  const session = makeSession(response);
  await saveSession(session);
  return session;
}

export async function signInCloudAccount(email: string, password: string) {
  const response = await authRequest('token?grant_type=password', { email: email.trim(), password });
  const session = makeSession(response);
  await saveSession(session);
  return session;
}

export async function getCloudSession(): Promise<CloudSession | null> {
  const saved = await readSavedSession();
  if (!saved) return null;
  if (saved.expires_at > Date.now() + 60_000) return saved;
  try {
    const response = await authRequest('token?grant_type=refresh_token', { refresh_token: saved.refresh_token });
    const refreshed = makeSession(response);
    await saveSession(refreshed);
    return refreshed;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function getCloudAccessToken(): Promise<string> {
  const session = await getCloudSession();
  if (!session) throw new Error('Connecte-toi à ton compte (Profil) pour utiliser cette fonction.');
  return session.access_token;
}

export async function signOutCloudAccount() {
  const session = await getCloudSession();
  if (session && PROJECT_URL && ANON_KEY) {
    await fetch(`${PROJECT_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {});
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

async function storageRequest(session: CloudSession, method: 'GET' | 'PUT', body?: string) {
  const { projectUrl, anonKey } = requireConfig();
  const path = `${encodeURIComponent(session.user.id)}/backup.json`;
  const response = await fetch(`${projectUrl}/storage/v1/object/${BUCKET}/${path}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      ...(method === 'PUT' ? { 'content-type': 'application/json', 'x-upsert': 'true' } : {}),
    },
    ...(body === undefined ? {} : { body }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response;
}

export async function saveCloudBackup() {
  const session = await getCloudSession();
  if (!session) throw new Error('Connecte-toi à ton compte pour sauvegarder.');
  await storageRequest(session, 'PUT', await createBackupString());
}

export async function restoreCloudBackup() {
  const session = await getCloudSession();
  if (!session) throw new Error('Connecte-toi à ton compte pour restaurer.');
  const response = await storageRequest(session, 'GET');
  return restoreBackupString(await response.text());
}
