// Thème sombre « néo-banque » : fond noir, dégradé violet en haut d'écran, cartes gris anthracite.
export const Palette = {
  background: '#000000',
  surface: '#1C1C1E',                       // cartes et listes
  surfaceRaised: '#2C2C2E',                 // boutons ronds, puces, champs de saisie
  surfaceSelected: '#3A3A3C',
  border: 'rgba(255,255,255,0.06)',
  hairline: 'rgba(255,255,255,0.22)',       // fin contour des pastilles de couleur sur fond sombre
  text: '#FFFFFF',
  textSecondary: '#9A9AA1',
  accent: '#7C5CFF',
  accentSoft: 'rgba(124,92,255,0.18)',
  success: '#34D399',
  danger: '#FF6B7A',
  warning: '#FBBF24',
  white: '#FFFFFF',
  black: '#000000',
  onAccent: '#FFFFFF',                      // texte et icônes sur fond violet ou sur « ink »
  ink: '#3A3A3C',                           // pastille sélectionnée des sélecteurs
  shadow: '#000000',
  overlay: 'rgba(255,255,255,0.16)',        // boutons translucides posés sur le dégradé
} as const;

/** Dégradé du haut d'écran : violet lumineux qui se fond dans le noir. */
export const HeaderGradient = 'linear-gradient(180deg, #A47BFF 0%, #6C3BF0 32%, #2A1366 62%, #000000 100%)';
export const SoftGradient = 'linear-gradient(180deg, #3B1D8F 0%, #160A33 45%, #000000 100%)';

/** Carte sombre partagée (ancien style « verre »). */
export const Glass = {
  backgroundColor: Palette.surface,
  borderWidth: 1,
  borderColor: Palette.border,
} as const;

export const Radius = {
  card: 24,
  pill: 999,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
