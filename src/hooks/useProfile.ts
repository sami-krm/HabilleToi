import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ColdLevel = 'frileux' | 'normal' | 'chaud';

export interface Profile {
  name: string;
  avatar?: string;
  style: 'casual' | 'sport' | 'formel' | 'soiree';
  cold: ColdLevel;
  unit: 'C' | 'F';
  notifications: boolean;
  calendarEnabled: boolean;
}

const KEY = 'profile';

export const DEFAULT_PROFILE: Profile = {
  name: '',
  style: 'casual',
  cold: 'normal',
  unit: 'C',
  notifications: true,
  calendarEnabled: false,
};

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const profileRef = useRef(DEFAULT_PROFILE);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (!v) return;
        profileRef.current = { ...DEFAULT_PROFILE, ...JSON.parse(v) };
        setProfile(profileRef.current);
      })
      .catch(() => {});
  }, []);

  const update = useCallback((patch: Partial<Profile>) => {
    const next = { ...profileRef.current, ...patch };
    profileRef.current = next;
    setProfile(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  return { profile, update };
}

/** Enregistre une partie du profil hors d'un écran (ex. à la fin du questionnaire). */
export async function patchStoredProfile(patch: Partial<Profile>): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  const current = { ...DEFAULT_PROFILE, ...(raw ? JSON.parse(raw) : {}) };
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
}
