import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Tenue</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'cloud.sun', selected: 'cloud.sun.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="wardrobe">
        <NativeTabs.Trigger.Label>Dressing</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'tshirt', selected: 'tshirt.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>Historique</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'clock', selected: 'clock.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="favorites">
        <NativeTabs.Trigger.Label>Favoris</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'star', selected: 'star.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}