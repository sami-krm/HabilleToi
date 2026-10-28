import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Palette } from '@/constants/theme';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={Palette.background}
      indicatorColor={Palette.surfaceSelected}
      blurEffect="systemChromeMaterialDark"
      iconColor={{ default: Palette.textSecondary, selected: Palette.white }}
      labelStyle={{ selected: { color: Palette.white }, default: { color: Palette.textSecondary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Tenue</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'cloud.sun', selected: 'cloud.sun.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="wardrobe">
        <NativeTabs.Trigger.Label>Dressing</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'tshirt', selected: 'tshirt.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="trip">
        <NativeTabs.Trigger.Label>Valise</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'suitcase', selected: 'suitcase.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="outfits">
        <NativeTabs.Trigger.Label>Mes tenues</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'star', selected: 'star.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
