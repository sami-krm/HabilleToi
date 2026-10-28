import DailyOutfitWidget from './DailyOutfitWidget';
import type { DailyOutfitWidgetProps } from './dailyOutfitTypes';

export function updateDailyOutfitWidget(props: DailyOutfitWidgetProps) {
  DailyOutfitWidget.updateSnapshot(props);
}
