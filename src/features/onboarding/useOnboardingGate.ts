import { useCallback, useEffect, useState } from 'react';
// import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadProfile } from './profile';

const MIN_LOADING_MS = 1500; // durée minimale de l'écran de chargement

/** Charge le profil au lancement et indique si le questionnaire a déjà été fait. */
export function useOnboardingGate() {
  const [state, setState] = useState({ ready: false, done: false });

  useEffect(() => {
    (async () => {
      // Pour revoir le questionnaire en développement, décommente la ligne suivante, lance l'app une fois, puis recommente-la :
      // await AsyncStorage.removeItem('@app/profile');
      const [profile] = await Promise.all([
        loadProfile(),
        new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS)),
      ]);
      setState({ ready: true, done: profile?.onboardingDone === true });
    })();
  }, []);

  const finish = useCallback(() => setState({ ready: true, done: true }), []);
  return { ...state, finish };
}