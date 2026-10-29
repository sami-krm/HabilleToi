import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------- Types ----------
export type Gender = 'femme' | 'homme' | 'autre';
export type Channel = 'sites-marques' | 'marketplaces' | 'seconde-main' | 'magasin';
export type Occupation = 'etudiant' | 'salarie' | 'independant' | 'recherche' | 'autre';
export type AgeRange = 'moins-18' | '18-24' | '25-34' | '35-44' | '45-54' | '55-plus';
export type Goal = 'temps' | 'meteo' | 'variete' | 'valise' | 'dressing';

export interface UserProfile {
  gender?: Gender;
  country?: string;
  channels?: Channel[];     // où l'on commande ses vêtements
  occupation?: Occupation;
  ageRange?: AgeRange;
  shops?: string[];         // ids des boutiques favorites
  goals?: Goal[];           // ce que l'on attend de l'app
  onboardingDone: boolean;
}

export interface Option<T extends string = string> {
  key: T;
  label: string;
  icon?: string; // nom d'icône MaterialCommunityIcons
}

// ---------- Questions ----------
export const GENDER_OPTIONS: Option<Gender>[] = [
  { key: 'femme', label: 'Femme', icon: 'gender-female' },
  { key: 'homme', label: 'Homme', icon: 'gender-male' },
  { key: 'autre', label: 'Autre / je préfère ne pas préciser', icon: 'account-outline' },
];

export const COUNTRIES = [
  'France', 'Belgique', 'Suisse', 'Luxembourg', 'Canada', 'Maroc', 'Algérie', 'Tunisie',
  'Sénégal', "Côte d'Ivoire", 'Royaume-Uni', 'États-Unis', 'Autre',
];

export const CHANNEL_OPTIONS: Option<Channel>[] = [
  { key: 'sites-marques', label: 'Sites de marques (H&M, Zara…)', icon: 'web' },
  { key: 'marketplaces', label: 'Marketplaces (Amazon, Zalando…)', icon: 'shopping-outline' },
  { key: 'seconde-main', label: 'Seconde main (Vinted…)', icon: 'recycle' },
  { key: 'magasin', label: 'En magasin', icon: 'storefront-outline' },
];

export const OCCUPATION_OPTIONS: Option<Occupation>[] = [
  { key: 'etudiant', label: 'Étudiant(e)', icon: 'school-outline' },
  { key: 'salarie', label: 'Salarié(e)', icon: 'briefcase-outline' },
  { key: 'independant', label: 'Indépendant(e) / freelance', icon: 'laptop' },
  { key: 'recherche', label: "En recherche d'emploi", icon: 'magnify' },
  { key: 'autre', label: 'Autre', icon: 'dots-horizontal' },
];

export const GOAL_OPTIONS: Option<Goal>[] = [
  { key: 'temps', label: 'Gagner du temps le matin', icon: 'timer-outline' },
  { key: 'meteo', label: 'Ne plus avoir trop chaud ou trop froid', icon: 'weather-partly-cloudy' },
  { key: 'variete', label: 'Varier mes tenues', icon: 'shuffle-variant' },
  { key: 'valise', label: 'Faire ma valise sans stress', icon: 'bag-suitcase-outline' },
  { key: 'dressing', label: 'Mieux connaître mon dressing', icon: 'hanger' },
];

export const AGE_OPTIONS: Option<AgeRange>[] = [
  { key: 'moins-18', label: 'Moins de 18 ans' },
  { key: '18-24', label: '18 – 24 ans' },
  { key: '25-34', label: '25 – 34 ans' },
  { key: '35-44', label: '35 – 44 ans' },
  { key: '45-54', label: '45 – 54 ans' },
  { key: '55-plus', label: '55 ans et plus' },
];

// ---------- Boutiques ----------
export interface Shop {
  id: string;
  name: string;
  domain: string; // sert à récupérer le logo
  url: string;    // page de départ du navigateur intégré
}

export const SHOPS: Shop[] = [
  { id: 'hm', name: 'H&M', domain: 'hm.com', url: 'https://www.hm.com' },
  { id: 'zara', name: 'Zara', domain: 'zara.com', url: 'https://www.zara.com' },
  { id: 'uniqlo', name: 'Uniqlo', domain: 'uniqlo.com', url: 'https://www.uniqlo.com' },
  { id: 'mango', name: 'Mango', domain: 'mango.com', url: 'https://shop.mango.com' },
  { id: 'bershka', name: 'Bershka', domain: 'bershka.com', url: 'https://www.bershka.com' },
  { id: 'pullandbear', name: 'Pull&Bear', domain: 'pullandbear.com', url: 'https://www.pullandbear.com' },
  { id: 'stradivarius', name: 'Stradivarius', domain: 'stradivarius.com', url: 'https://www.stradivarius.com' },
  { id: 'massimodutti', name: 'Massimo Dutti', domain: 'massimodutti.com', url: 'https://www.massimodutti.com' },
  { id: 'cos', name: 'COS', domain: 'cos.com', url: 'https://www.cos.com' },
  { id: 'primark', name: 'Primark', domain: 'primark.com', url: 'https://www.primark.com' },
  { id: 'kiabi', name: 'Kiabi', domain: 'kiabi.com', url: 'https://www.kiabi.com' },
  { id: 'celio', name: 'Celio', domain: 'celio.com', url: 'https://www.celio.com' },
  { id: 'jules', name: 'Jules', domain: 'jules.com', url: 'https://www.jules.com' },
  { id: 'bonobo', name: 'Bonobo', domain: 'bonoboplanet.com', url: 'https://www.bonoboplanet.com' },
  { id: 'promod', name: 'Promod', domain: 'promod.fr', url: 'https://www.promod.fr' },
  { id: 'etam', name: 'Etam', domain: 'etam.com', url: 'https://www.etam.com' },
  { id: 'gap', name: 'Gap', domain: 'gap.fr', url: 'https://www.gap.fr' },
  { id: 'levis', name: 'Levi’s', domain: 'levi.com', url: 'https://www.levi.com' },
  { id: 'sezane', name: 'Sézane', domain: 'sezane.com', url: 'https://www.sezane.com' },
  { id: 'lacoste', name: 'Lacoste', domain: 'lacoste.com', url: 'https://www.lacoste.com' },
  { id: 'ralphlauren', name: 'Ralph Lauren', domain: 'ralphlauren.fr', url: 'https://www.ralphlauren.fr' },
  { id: 'tommy', name: 'Tommy Hilfiger', domain: 'tommy.com', url: 'https://fr.tommy.com' },
  { id: 'nike', name: 'Nike', domain: 'nike.com', url: 'https://www.nike.com' },
  { id: 'adidas', name: 'Adidas', domain: 'adidas.fr', url: 'https://www.adidas.fr' },
  { id: 'puma', name: 'Puma', domain: 'puma.com', url: 'https://eu.puma.com' },
  { id: 'newbalance', name: 'New Balance', domain: 'newbalance.fr', url: 'https://www.newbalance.fr' },
  { id: 'decathlon', name: 'Decathlon', domain: 'decathlon.fr', url: 'https://www.decathlon.fr' },
  { id: 'courir', name: 'Courir', domain: 'courir.com', url: 'https://www.courir.com' },
  { id: 'footlocker', name: 'Foot Locker', domain: 'footlocker.fr', url: 'https://www.footlocker.fr' },
  { id: 'jdsports', name: 'JD Sports', domain: 'jdsports.fr', url: 'https://www.jdsports.fr' },
  { id: 'thenorthface', name: 'The North Face', domain: 'thenorthface.fr', url: 'https://www.thenorthface.fr' },
  { id: 'zalando', name: 'Zalando', domain: 'zalando.fr', url: 'https://www.zalando.fr' },
  { id: 'asos', name: 'ASOS', domain: 'asos.com', url: 'https://www.asos.com' },
  { id: 'shein', name: 'Shein', domain: 'shein.com', url: 'https://fr.shein.com' },
  { id: 'laredoute', name: 'La Redoute', domain: 'laredoute.fr', url: 'https://www.laredoute.fr' },
  { id: 'galerieslafayette', name: 'Galeries Lafayette', domain: 'galerieslafayette.com', url: 'https://www.galerieslafayette.com' },
  { id: 'amazon', name: 'Amazon', domain: 'amazon.fr', url: 'https://www.amazon.fr' },
  { id: 'veepee', name: 'Veepee', domain: 'veepee.fr', url: 'https://www.veepee.fr' },
  { id: 'vinted', name: 'Vinted', domain: 'vinted.fr', url: 'https://www.vinted.fr' },
  { id: 'vestiaire', name: 'Vestiaire Collective', domain: 'vestiairecollective.com', url: 'https://fr.vestiairecollective.com' },
  { id: 'leboncoin', name: 'leboncoin', domain: 'leboncoin.fr', url: 'https://www.leboncoin.fr' },
];

// ---------- Stockage ----------
const PROFILE_KEY = '@app/profile';

export async function loadProfile(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export const saveProfile = (profile: UserProfile) =>
  AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));