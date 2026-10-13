// Passe « Aurore claire » : corrige les ombres cassées, ajoute le fond aurore aux écrans,
// le style Glass, et la config iOS (mode clair). Relançable sans risque.
// Usage (à la racine du projet) : node scripts/apply-aurora.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);
const exists = (f) => fs.existsSync(path.join(root, f));

function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

// 1. Ombres cassées par le remplacement global + pastilles de couleur visibles sur fond clair
for (const f of walk('src')) {
  const before = read(f);
  const after = before
    .replace(/shadowcolor: Palette\.onAccent, shadowOpacity: 0\.3/g, 'shadowColor: Palette.shadow, shadowOpacity: 0.16')
    .replace(/((?:dot|swatch): \{[^}]*borderColor: )Palette\.border/g, '$1Palette.hairline');
  if (after !== before) { write(f, after); console.log(`✓ ombres / pastilles : ${f}`); }
}

// 2. Texte du choix sélectionné (questionnaire) : blanc sur violet
{
  const f = 'src/features/onboarding/OnboardingFlow.tsx';
  const s = read(f);
  const t = s.replace('selected ? Palette.black : Palette.text', 'selected ? Palette.onAccent : Palette.text');
  if (t !== s) { write(f, t); console.log(`✓ ${f} : texte sélectionné`); }
}

// 3. Fond aurore : la racine <SafeAreaView style={styles.safe}> devient <AuroraScreen>
const SCREENS = [
  'src/app/outfits.tsx',
  'src/app/trip.tsx',
  'src/app/wardrobe.tsx',
  'src/features/trip/TripForm.tsx',
  'src/features/trip/TripResult.tsx',
  'src/features/onboarding/OnboardingFlow.tsx',
];
for (const f of SCREENS) {
  let s = read(f);
  if (s.includes('<AuroraScreen>')) { console.log(`= ${f} : déjà fait`); continue; }
  const open = '<SafeAreaView style={styles.safe}>';
  const close = '</SafeAreaView>';
  const i = s.indexOf(open);
  const j = s.lastIndexOf(close);
  if (i < 0 || j < i) { console.log(`! ${f} : racine introuvable, à faire à la main`); continue; }
  s = s.slice(0, i) + '<AuroraScreen>' + s.slice(i + open.length, j) + '</AuroraScreen>' + s.slice(j + close.length);
  s = "import AuroraScreen from '@/components/AuroraScreen';\n" + s;
  write(f, s);
  console.log(`✓ ${f} : fond aurore`);
}

// 3 bis. Vues de « Mes tenues » : racine transparente pour laisser voir l'aurore
for (const f of ['src/features/outfits/FavoritesView.tsx', 'src/features/outfits/HistoryView.tsx']) {
  const s = read(f);
  const t = s.replace('safe: { flex: 1, backgroundColor: Palette.background }', 'safe: { flex: 1 }');
  if (t !== s) { write(f, t); console.log(`✓ ${f} : fond transparent`); }
}

// 4. Style « verre » partagé dans le thème
{
  const f = 'src/constants/theme.ts';
  let s = read(f);
  if (s.includes('export const Glass')) {
    console.log('= theme.ts : Glass déjà présent');
  } else if (!s.includes('export type ThemeColor')) {
    console.log('! theme.ts : repère introuvable, ajoute Glass à la main');
  } else {
    const glass = `/** Style « verre » partagé : blanc translucide, contour clair, ombre violette douce. */
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

`;
    s = s.replace('export type ThemeColor', glass + 'export type ThemeColor');
    write(f, s);
    console.log('✓ theme.ts : Glass ajouté');
  }
}

// 5. Config iOS : mode clair + couleurs de fond
if (exists('app.json')) {
  const s = read('app.json');
  const t = s
    .replace('"userInterfaceStyle": "dark"', '"userInterfaceStyle": "light"')
    .replace(/"backgroundColor": "#0C0B11"/g, '"backgroundColor": "#F4F1FF"');
  if (t !== s) { write('app.json', t); console.log('✓ app.json : mode clair'); }
}

console.log('Terminé.');