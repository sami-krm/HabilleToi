import type { ClothingType, ColorName } from '@/types';

export type ProductKind = 'clothing' | 'other' | 'unknown';

export interface RuleResult {
  kind: ProductKind;
  type?: ClothingType;
  colors: ColorName[]; // la couleur dominante en premier
}

/** Minuscules, sans accents, ponctuation simplifiée : « T-Shirt Écru » → « t shirt ecru ». */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Cherche un mot dans le texte (début de mot obligatoire, donc « red » ne se trouve pas dans « tailored »).
 * Un mot terminé par « $ » doit aussi être un mot entier (avec pluriel et féminin tolérés).
 */
function findWord(text: string, word: string): { index: number; length: number } | null {
  const strict = word.endsWith('$');
  const w = escapeRegex(normalize(strict ? word.slice(0, -1) : word));
  const re = new RegExp(`(?:^|[^a-z0-9])(${w}${strict ? '(?:e|es|s)?' : ''})${strict ? '(?:$|[^a-z0-9])' : ''}`);
  const m = re.exec(text);
  if (!m) return null;
  return { index: m.index + m[0].indexOf(m[1]), length: m[1].length };
}

const hasAny = (text: string, words: string[]) => words.some((w) => findWord(text, w));

// ---------- Ce qui n'est pas un vêtement géré par l'app ----------
const OTHER_WORDS = [
  // sacs et accessoires
  'sac$', 'sac a dos', 'sacoche', 'backpack', 'bag$', 'cartable', 'banane$', 'pochette', 'portefeuille', 'wallet', 'valise',
  'ceinture', 'belt$', 'casquette', 'cap$', 'bob$', 'chapeau', 'gant$',
  'lunettes', 'sunglasses', 'montre', 'watch$', 'bijou', 'collier', 'bracelet', 'bague', 'boucles d oreilles', 'cravate', 'noeud papillon',
  'porte cle',
  // beauté, entretien, maison
  'parfum', 'eau de toilette', 'deodorant', 'deo$', 'gel douche', 'shampoing', 'shampoo', 'creme hydratante', 'creme solaire', 'creme visage', 'face cream', 'hand cream', 'lotion', 'savon',
  'soin', 'maquillage', 'rasoir', 'brosse', 'serviette', 'bougie', 'coque', 'cable usb', 'cable de charge', 'chargeur', 'carte cadeau', 'gift card',
  // sous-vêtements, chaussettes, nuit
  'chaussette', 'sock$', 'socks', 'sous vetement', 'underwear', 'boxer', 'shorty', 'calecon', 'culotte', 'string$', 'slip homme', 'slip femme', 'slip coton',
  'soutien gorge', 'lingerie', 'brassiere', 'collant', 'pyjama', 'nuisette', 'peignoir', 'robe de chambre',
  // vêtements non gérés
  'combinaison', 'jumpsuit', 'maillot de bain', 'bikini', 'swimsuit', 'caftan',
  // éléments de page qui ne sont pas des produits
  'qr code', 'qrcode', 'download', 'telecharger', 'app store', 'google play', 'newsletter', 'livraison', 'retour gratuit',
  'paiement', 'trustpilot',
];

// ---------- Types de vêtements (l'ordre compte : le plus précis d'abord) ----------
const TYPE_WORDS: [ClothingType, string[]][] = [
  ['short', ['short', 'bermuda']],
  ['parapluie', ['parapluie', 'umbrella', 'paraguas']],
  ['bonnet', ['bonnet', 'beanie', 'chapeau en maille']],
  ['echarpe', ['echarpe', 'scarf', 'foulard']],
  ['robe', ['robe$', 'dress$', 'vestido', 'abito']],
  ['jupe', ['jupe', 'skirt$', 'falda', 'gonna']],
  ['chaussures', [
    'chaussure', 'basket', 'sneaker', 'trainer$', 'shoe$', 'sandale', 'sandal', 'chausson', 'mule$', 'claquette',
    'tong$', 'botte', 'boot$', 'bottine', 'mocassin', 'loafer', 'derby$', 'richelieu', 'escarpin', 'ballerine', 'espadrille',
    'slipper', 'schuh', 'zapatilla', 'scarpa',
  ]],
  ['veste_epaisse', ['veste chaude', 'manteau', 'parka', 'doudoune', 'anorak', 'polaire', 'puffer', 'heavy jacket', 'winter coat']],
  ['veste_legere', ['veste legere', 'coupe vent', 'windbreaker', 'light jacket', 'bomber', 'perfecto']],
  ['veste', [
    'veste', 'blouson', 'trench', 'imper$', 'impermeable', 'jacket', 'coat$', 'blazer', 'jakke', 'jacke',
  ]],
  ['pantalon', [
    'pantalon', 'sweatpant', 'jean$', 'jeans', 'chino', 'jogging', 'jogger', 'legging', 'cargo$', 'trouser', 'pant$', 'pants', 'sarouel',
    'bukser', 'hose$', 'pantalones', 'pantaloni',
  ]],
  ['pull', [
    'pull', 'sweat', 'hoodie', 'capuche', 'gilet', 'cardigan', 'maille', 'col roule', 'jumper', 'sweater', 'knit', 'fleece',
    'strik', 'pullover',
  ]],
  ['tshirt', ['t shirt', 'tshirt', 'tee shirt', 'tee$', 'debardeur', 'tank top', 'polo$', 'maillot', 'jersey$', 'camiseta']],
  ['chemise', ['chemise', 'blouse', 'overshirt', 'shirt$', 'camisa', 'camicia', 'skjorte', 'hemd$']],
];

// ---------- Couleurs (les phrases précises d'abord : « bleu marine » avant « bleu ») ----------
const COLOR_WORDS: [ColorName, string[]][] = [
  ['marine', ['bleu marine', 'bleu nuit', 'navy', 'marine', 'midnight blue', 'marinblau']],
  ['blanc', ['off white', 'blanc', 'white', 'hvid', 'weiss', 'weis', 'blanco', 'bianco', 'ivory', 'ivoire']],
  ['noir', ['noir', 'black', 'sort$', 'schwarz', 'negro', 'nero']],
  ['gris', ['gris', 'grey', 'gray', 'grau', 'grigio', 'anthracite', 'charcoal', 'chine', 'heather']],
  ['beige', ['beige', 'ecru', 'sable', 'sand$', 'camel', 'creme', 'cream$', 'nude', 'stone$', 'taupe', 'oat', 'khaki sable']],
  ['marron', ['marron', 'brun', 'chocolat', 'brown', 'braun', 'marrone', 'cognac', 'tan$', 'cafe']],
  ['bleu', ['bleu', 'blue', 'blau', 'azul', 'blu$', 'denim', 'indigo', 'ciel', 'turquoise', 'cyan']],
  ['rouge', ['rouge', 'red$', 'rot$', 'rojo', 'rosso', 'bordeaux', 'burgundy', 'cerise']],
  ['vert', ['vert', 'green', 'grun', 'verde', 'kaki', 'khaki', 'olive', 'sauge', 'sage$', 'emeraude']],
  ['jaune', ['jaune', 'yellow', 'gelb', 'amarillo', 'giallo', 'moutarde', 'mustard']],
  ['orange', ['orange', 'corail', 'coral', 'terracotta', 'rouille', 'rust$']],
  ['rose', ['rose', 'pink', 'rosa', 'fuchsia', 'saumon']],
  ['violet', ['violet', 'purple', 'lila', 'lilas', 'mauve', 'prune', 'lavande', 'lavender']],
];

/** Couleurs trouvées dans le texte, la première citée en premier (au plus 3). */
export function findColors(raw: string): ColorName[] {
  let text = ` ${normalize(raw)} `;
  const found: { color: ColorName; index: number }[] = [];
  for (const [color, words] of COLOR_WORDS) {
    for (const word of words) {
      const hit = findWord(text, word);
      if (!hit) continue;
      found.push({ color, index: hit.index });
      // On efface le mot trouvé pour qu'« navy » n'apparaisse pas aussi dans « bleu » par exemple
      text = text.slice(0, hit.index) + ' '.repeat(hit.length) + text.slice(hit.index + hit.length);
      break;
    }
  }
  return found.sort((a, b) => a.index - b.index).slice(0, 3).map((f) => f.color);
}

/** Type de vêtement d'après le nom, ou undefined si aucun mot ne correspond. */
export function findType(raw: string): ClothingType | undefined {
  const text = ` ${normalize(raw)} `;
  for (const [type, words] of TYPE_WORDS) {
    if (hasAny(text, words)) return type;
  }
  return undefined;
}

/** Retire les noms de marques qui contiennent un mot-clé (« Pull&Bear », « Tommy Jeans », « Polo Ralph Lauren »...). */
function cleanBrands(raw: string): string {
  return raw
    .replace(/pull\s*(?:&|and|et)\s*bear/gi, ' ')
    .replace(/\b(?:tommy|calvin klein|ck|pepe)\s+jeans\b/gi, ' ')
    .replace(/\bpolo\s+ralph\s+lauren\b/gi, ' ralph lauren ');
}

/**
 * Première analyse, instantanée et gratuite, à partir du nom de l'article.
 * Les noms « Marque, MODÈLE - Catégorie - couleur, taille » (Zalando...) sont lus par segment.
 */
export function classifyProduct(name: string, context = ''): RuleResult {
  const parts = name.split(/\s+-\s+/);
  const structured = parts.length >= 3;
  const category = structured ? parts[1] : cleanBrands(name);
  const whole = cleanBrands(name);

  // Pas un vêtement ? (on regarde la catégorie si on la connaît, sinon tout le nom)
  if (hasAny(` ${normalize(category)} `, OTHER_WORDS) || (!structured && hasAny(` ${normalize(whole)} `, OTHER_WORDS))) {
    return { kind: 'other', colors: [] };
  }

  const type = findType(category) ?? findType(whole) ?? findType(cleanBrands(context));
  const colorText = structured ? parts.slice(2).join(' ') : whole;
  const colors = findColors(colorText).length > 0 ? findColors(colorText) : findColors(whole).length > 0 ? findColors(whole) : findColors(context);
  return { kind: type ? 'clothing' : 'unknown', type, colors };
}
