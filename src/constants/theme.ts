/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Palette = {
  background: '#F4F1FF',
  surface: 'rgba(255,255,255,0.58)',        // verre
  surfaceRaised: 'rgba(255,255,255,0.88)',  // verre plus opaque (carte de tenue)
  surfaceSelected: '#FFFFFF',
  border: 'rgba(255,255,255,0.95)',
  hairline: 'rgba(23,20,43,0.14)',          // fin contour visible sur fond clair (pastilles de couleur)
  text: '#17142B',
  textSecondary: '#4E4968',
  accent: '#5B3DF5',
  accentSoft: 'rgba(91,61,245,0.12)',
  success: '#13825A',
  danger: '#C93550',
  warning: '#A8630A',
  white: '#FFFFFF',
  black: '#17142B',
  onAccent: '#FFFFFF',                      // texte et icônes sur fond violet
  ink: '#17142B',                           // fond des boutons sombres
  shadow: '#46329F',
} as const;

// L'app garde le thème « Aurore claire » quel que soit le mode du téléphone.
const appColors = {
  text: Palette.text,
  background: Palette.background,
  backgroundElement: Palette.surface,
  backgroundSelected: Palette.surfaceSelected,
  textSecondary: Palette.textSecondary,
} as const;

export const Colors = {
  light: appColors,
  dark: appColors,
} as const;

/** Style « verre » partagé : blanc translucide, contour clair, ombre violette douce. */
export const Glass = {
  backgroundColor: Palette.surface,
  borderWidth: 1,
  borderColor: Palette.border,
  shadowColor: Palette.shadow,
  shadowOpacity: 0.12,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
