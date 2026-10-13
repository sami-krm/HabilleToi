import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { Palette } from '@/constants/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface WeatherVisual {
  name: IconName;
  color: string;
  label: string; // pour l'accessibilité
}

const SUN = '#F2A33A';

/** Icône correspondant au code météo Open-Meteo (WMO). */
export function weatherVisual(code: number | undefined, isDay = true): WeatherVisual {
  if (code === undefined) return { name: 'weather-partly-cloudy', color: Palette.textSecondary, label: 'Météo' };

  if (code <= 1) {
    return isDay
      ? { name: 'weather-sunny', color: SUN, label: 'Ensoleillé' }
      : { name: 'weather-night', color: Palette.accent, label: 'Nuit dégagée' };
  }
  if (code === 2) {
    return isDay
      ? { name: 'weather-partly-cloudy', color: Palette.textSecondary, label: 'Éclaircies' }
      : { name: 'weather-night-partly-cloudy', color: Palette.accent, label: 'Nuit nuageuse' };
  }
  if (code === 3) return { name: 'weather-cloudy', color: Palette.textSecondary, label: 'Nuageux' };
  if (code === 45 || code === 48) return { name: 'weather-fog', color: Palette.textSecondary, label: 'Brouillard' };
  if (code === 65 || code === 67 || code === 82) return { name: 'weather-pouring', color: Palette.accent, label: 'Forte pluie' };
  if (code >= 51 && code <= 82 && !(code >= 71 && code <= 77)) {
    return { name: 'weather-rainy', color: Palette.accent, label: 'Pluie' };
  }
  if (code === 86) return { name: 'weather-snowy-heavy', color: Palette.accent, label: 'Fortes chutes de neige' };
  if ((code >= 71 && code <= 77) || code === 85) return { name: 'weather-snowy', color: Palette.accent, label: 'Neige' };
  if (code >= 95) return { name: 'weather-lightning-rainy', color: Palette.accent, label: 'Orage' };
  return { name: 'weather-cloudy', color: Palette.textSecondary, label: 'Nuageux' };
}