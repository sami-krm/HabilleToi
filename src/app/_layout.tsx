import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import LoadingScreen from '@/components/loading-screen';
import OnboardingFlow from '@/features/onboarding/OnboardingFlow';
import { useOnboardingGate } from '@/features/onboarding/useOnboardingGate';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { ready, done, finish } = useOnboardingGate();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        {!ready ? <LoadingScreen /> : done ? <AppTabs /> : <OnboardingFlow onFinish={finish} />}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}