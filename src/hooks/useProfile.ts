import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

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

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => v && setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(v) }))
      .catch(() => {});
  }, []);

  const update = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { profile, update };
}
