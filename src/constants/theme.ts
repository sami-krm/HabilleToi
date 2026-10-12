/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Palette = {
  background: '#0C0B11',
  surface: '#15131B',
  surfaceRaised: '#1D1A25',
  surfaceSelected: '#2B2240',
  border: '#302B3B',
  text: '#F5F2FA',
  textSecondary: '#A6A0B3',
  accent: '#9B7BFF',
  accentSoft: '#2A2140',
  success: '#56D6A0',
  danger: '#F17D91',
  warning: '#F2C574',
  white: '#FFFFFF',
  black: '#08070B',
} as const;

// L'app conserve le thème Atelier nocturne même si le téléphone est en mode clair.
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
