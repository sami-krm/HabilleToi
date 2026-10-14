import { loadWardrobe, saveWardrobe } from '@/storage/wardrobeStorage';
import type { ClothingItem, ClothingType, ColorName, Style } from '@/types';

const DEMO_PREFIX = 'demo-';

// Images : un pixel de la couleur du vêtement, étiré (aucune photo ni connexion nécessaire)
const PIXELS: Record<ColorName, string> = {
  noir: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mMQFBQEAABqADSHHyNhAAAAAElFTkSuQmCC',
  blanc: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP48uULAAW8At0lKy4iAAAAAElFTkSuQmCC',
  gris: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mOYN28eAAO4AdvUX8G3AAAAAElFTkSuQmCC',
  beige: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mO4cXgpAAS3AkGvJks2AAAAAElFTkSuQmCC',
  marine: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mOQ13IBAAD5AI55KdetAAAAAElFTkSuQmCC',
  marron: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mPIdlEGAAHwANOXo7HLAAAAAElFTkSuQmCC',
  bleu: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mPQz38LAAJcAYxKBrv/AAAAAElFTkSuQmCC',
  rouge: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mO4rK8PAAMKATI/39WkAAAAAElFTkSuQmCC',
  vert: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mPQ6w4HAAH7ARFK28dFAAAAAElFTkSuQmCC',
  jaune: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP4csQAAASYAen4fEc8AAAAAElFTkSuQmCC',
  orange: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP4WsMAAAPbAXKfnkG9AAAAAElFTkSuQmCC',
  rose: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP40r8RAASvAjXxuMt2AAAAAElFTkSuQmCC',
  violet: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mOoCz8EAALuAZiWzKpQAAAAAElFTkSuQmCC',
};

interface SeedOptions {
  extra?: ColorName[]; // couleurs secondaires (rayures, carreaux...)
  motif?: boolean;     // vêtement à motifs
  dirty?: boolean;     // au sale
}
type Seed = [ClothingType, ColorName, Style[], SeedOptions?];

const SEEDS: Seed[] = [
  // T-shirts
  ['tshirt', 'blanc', ['casual', 'sport']],
  ['tshirt', 'noir', ['casual', 'soiree']],
  ['tshirt', 'gris', ['casual', 'sport']],
  ['tshirt', 'bleu', ['casual']],
  ['tshirt', 'jaune', ['casual']],
  ['tshirt', 'rouge', ['sport']],
  ['tshirt', 'blanc', ['casual'], { extra: ['marine'], motif: true }], // rayé
  // Chemises
  ['chemise', 'blanc', ['formel', 'casual', 'soiree']],
  ['chemise', 'bleu', ['formel', 'casual']],
  ['chemise', 'marine', ['formel', 'soiree']],
  ['chemise', 'beige', ['casual']],
  ['chemise', 'rose', ['casual', 'soiree']],
  ['chemise', 'bleu', ['casual'], { extra: ['blanc'], motif: true }], // carreaux
  // Pulls
  ['pull', 'marine', ['casual', 'formel']],
  ['pull', 'gris', ['casual']],
  ['pull', 'noir', ['casual', 'soiree', 'formel']],
  ['pull', 'vert', ['casual', 'sport']],
  ['pull', 'beige', ['casual']],
  ['pull', 'rouge', ['casual'], { dirty: true }], // au sale : ne doit jamais être proposé
  // Vestes
  ['veste', 'noir', ['casual', 'soiree', 'formel']],
  ['veste', 'beige', ['casual']],
  ['veste', 'marine', ['formel', 'casual']],
  ['veste', 'vert', ['casual', 'sport']],
  // Pantalons
  ['pantalon', 'noir', ['formel', 'soiree', 'casual']],
  ['pantalon', 'marine', ['formel', 'casual']],
  ['pantalon', 'beige', ['casual']],
  ['pantalon', 'gris', ['casual', 'sport']],
  ['pantalon', 'bleu', ['casual']],
  // Shorts
  ['short', 'noir', ['sport', 'casual']],
  ['short', 'beige', ['casual']],
  ['short', 'gris', ['sport', 'casual']],
  ['short', 'marine', ['casual']],
  // Chaussures
  ['chaussures', 'blanc', ['casual', 'sport']],
  ['chaussures', 'noir', ['formel', 'soiree', 'casual']],
  ['chaussures', 'marron', ['casual', 'formel']],
];

const buildItems = (): ClothingItem[] =>
  SEEDS.map(([type, color, styles, opt], i) => ({
    id: `${DEMO_PREFIX}${i + 1}`,
    uri: `data:image/png;base64,${PIXELS[color]}`,
    type,
    color,
    extraColors: opt?.extra ?? [],
    styles,
    pattern: opt?.motif ? 'motif' : 'uni',
    clean: !opt?.dirty,
  }));

/** Ajoute les vêtements de test (remplace d'anciens tests s'il y en a). */
export async function addDemoWardrobe(): Promise<number> {
  const existing = await loadWardrobe();
  const real = existing.filter((i) => !i.id.startsWith(DEMO_PREFIX));
  const demo = buildItems();
  await saveWardrobe([...real, ...demo]);
  return demo.length;
}

/** Retire uniquement les vêtements de test. */
export async function removeDemoWardrobe(): Promise<number> {
  const existing = await loadWardrobe();
  const real = existing.filter((i) => !i.id.startsWith(DEMO_PREFIX));
  await saveWardrobe(real);
  return existing.length - real.length;
}