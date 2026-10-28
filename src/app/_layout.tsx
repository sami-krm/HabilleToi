import { DarkTheme, ThemeProvider } from 'expo-router';
import { useLifecycleLog } from '@/utils/lifecycleLog';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import LoadingScreen from '@/components/loading-screen';
import { Palette } from '@/constants/theme';
import OnboardingFlow from '@/features/onboarding/OnboardingFlow';
import { useOnboardingGate } from '@/features/onboarding/useOnboardingGate';

SplashScreen.preventAutoHideAsync();

// Thème de navigation sombre, aux couleurs de l'app
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Palette.background,
    card: Palette.background,
    border: Palette.border,
    text: Palette.text,
    primary: Palette.accent,
  },
};

export default function TabLayout() {
  const { ready, done, finish } = useOnboardingGate();
  useLifecycleLog('Layout racine');

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <AnimatedSplashOverlay />
        <StatusBar style="light" />
        {!ready ? <LoadingScreen /> : done ? <AppTabs /> : <OnboardingFlow onFinish={finish} />}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}