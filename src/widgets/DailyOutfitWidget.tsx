import { Text, VStack } from '@expo/ui/swift-ui';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import type { DailyOutfitWidgetProps } from './dailyOutfitTypes';

const DailyOutfitWidget = (props: DailyOutfitWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  const title = 'Tenue du jour';
  const subtitle = props.outfit || 'Ouvre l’app pour composer ta tenue';
  const city = props.city ? `${props.city} · ${props.temperature}` : props.temperature;

  if (environment.widgetFamily === 'systemSmall') {
    return (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle('#34275B')]}>{title}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle('#514778')]}>{city}</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle('#34275B')]}>{subtitle}</Text>
      </VStack>
    );
  }

  return (
    <VStack modifiers={[padding({ all: 16 })]}>
      <Text modifiers={[font({ weight: 'bold', size: 18 }), foregroundStyle('#34275B')]}>{title}</Text>
      <Text modifiers={[font({ size: 13 }), foregroundStyle('#514778')]}>{city}</Text>
      <Text modifiers={[font({ size: 15 }), foregroundStyle('#34275B')]}>{subtitle}</Text>
    </VStack>
  );
};

export default createWidget('DailyOutfitWidget', DailyOutfitWidget);
