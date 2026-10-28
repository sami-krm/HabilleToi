import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadProfile } from './profile';

const FIRST_OPEN_LOADING_MS = 450;
const FIRST_OPEN_KEY = '@app/has-opened';

/** Charge le profil au lancement et indique si le questionnaire a déjà été fait. */
export function useOnboardingGate() {
  const [state, setState] = useState({ ready: false, done: false });

  useEffect(() => {
    (async () => {
      // Pour revoir le questionnaire en développement, décommente la ligne suivante, lance l'app une fois, puis recommente-la :
      await AsyncStorage.removeItem('@app/profile');
      const alreadyOpened = await AsyncStorage.getItem(FIRST_OPEN_KEY);
      const [profile] = await Promise.all([
        loadProfile(),
        new Promise((resolve) => setTimeout(resolve, alreadyOpened ? 0 : FIRST_OPEN_LOADING_MS)),
      ]);
      await AsyncStorage.setItem(FIRST_OPEN_KEY, 'true');
      setState({ ready: true, done: profile?.onboardingDone === true });
    })();
  }, []);

  const finish = useCallback(() => setState({ ready: true, done: true }), []);
  return { ...state, finish };
}
