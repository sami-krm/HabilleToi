import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { DailyOutfitWidgetProps } from './dailyOutfitTypes';

// Expo Go n'embarque pas le module natif ExpoWidgets.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Le widget est chargé une seule fois, et seulement quand on en a besoin.
// `undefined` = pas encore essayé, `null` = indisponible.
let widget: { updateSnapshot: (props: DailyOutfitWidgetProps) => void } | null | undefined;

function loadWidget() {
  if (widget !== undefined) return widget;

  if (isExpoGo) {
    widget = null;
    return widget;
  }

  try {
    // require paresseux : le module natif n'est cherché qu'à cet instant,
    // pas au démarrage de l'app (contrairement à un import en haut de fichier).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    widget = require('./DailyOutfitWidget').default;
  } catch (error) {
    console.warn('Widget iOS indisponible :', error);
    widget = null;
  }
  return widget;
}

export function updateDailyOutfitWidget(props: DailyOutfitWidgetProps) {
  try {
    loadWidget()?.updateSnapshot(props);
  } catch (error) {
    console.warn('Mise à jour du widget impossible :', error);
  }
}