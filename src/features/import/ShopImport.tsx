import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLifecycleLog } from '@/utils/lifecycleLog';
import { Palette } from '@/constants/theme';
import ShopLogo from '@/features/onboarding/ShopLogo';
import { SHOPS, type Shop } from '@/features/onboarding/profile';
import { loadWardrobe, saveWardrobe } from '@/storage/wardrobeStorage';
import type { ClothingItem } from '@/types';
import ImportResults from './ImportResults';
import ShopBrowser from './ShopBrowser';
import {
    notifyImportDone, requestNotificationPermission, storeImage, toFoundItem,
    type FoundItem, type RawItem,
} from './importUtils';

type Phase = 'intro' | 'browser' | 'results' | 'importing' | 'done';

interface Props {
  shopIds: string[];      // boutiques favorites du profil
  onBack: () => void;
  onDone: () => void;
  standalone?: boolean;   // true depuis l'onglet Dressing : toutes les boutiques sont proposées
}

export default function ShopImport({ shopIds, onBack, onDone, standalone = false }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [shop, setShop] = useState<Shop | null>(null);
  const [found, setFound] = useState<FoundItem[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [importedCount, setImportedCount] = useState(0);
  const [knownUrls, setKnownUrls] = useState<Set<string>>(new Set()); // articles déjà dans le dressing
  useLifecycleLog('ShopImport');
  useEffect(() => { console.log('[cycle] ShopImport phase =', phase); }, [phase]);

  // Retient les images déjà importées pour ne pas les reproposer
  useEffect(() => {
    loadWardrobe().then((wardrobe) =>
      setKnownUrls(new Set(wardrobe.map((i) => i.sourceUrl).filter((u): u is string => !!u))),
    );
  }, []);

  const favorites = SHOPS.filter((s) => shopIds.includes(s.id));
  const others = standalone ? SHOPS.filter((s) => !shopIds.includes(s.id)) : [];

  // Ajoute les articles détectés (sans doublons) et renvoie le nombre de nouveaux
  const addFound = (raw: RawItem[]): number => {
    const already = new Set(found.map((f) => f.id));
    const fresh = raw
      .filter((r) => r.image && !already.has(r.image) && !knownUrls.has(r.image))
      .map(toFoundItem);
    if (fresh.length > 0) setFound((prev) => [...prev, ...fresh]);
    return fresh.length;
  };

  const runImport = async (selected: FoundItem[]) => {
    setPhase('importing');
    setProgress({ done: 0, total: selected.length });
    await requestNotificationPermission();

    const existing = await loadWardrobe();
    const created: ClothingItem[] = [];

    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      const id = `${Date.now()}-${i}`;
      const uri = await storeImage(f.image, id);
      created.push({
        id, uri, type: f.type, color: f.color, extraColors: f.extraColors ?? [],
        styles: f.styles ?? ['casual'], pattern: f.pattern ?? 'uni', clean: true,
        sourceUrl: f.image,
      });
      setProgress({ done: i + 1, total: selected.length });
    }

    await saveWardrobe([...existing, ...created]);
    await notifyImportDone(created.length);
    setImportedCount(created.length);
    setPhase('done');
  };

  const openShop = (s: Shop) => {
    setShop(s);
    setPhase('browser');
  };

  // ---------- Navigateur ----------
  if (phase === 'browser' && shop) {
    return (
      <ShopBrowser
        shop={shop}
        foundCount={found.length}
        onItems={addFound}
        onClose={() => setPhase('intro')}
        onReview={() => setPhase('results')}
      />
    );
  }

  // ---------- Liste d'articles ----------
  if (phase === 'results') {
    return <ImportResults items={found} onBack={() => setPhase('browser')} onConfirm={runImport} />;
  }

  // ---------- Import en cours ----------
  if (phase === 'importing') {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={Palette.accent} />
        <Text style={styles.title}>Import en cours…</Text>
        <Text style={styles.sub}>{progress.done} / {progress.total}</Text>
        <Text style={styles.sub}>Garde l’app ouverte : une notification t’avertira à la fin.</Text>
      </SafeAreaView>
    );
  }

  // ---------- Terminé ----------
  if (phase === 'done') {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <MaterialCommunityIcons name="check-circle" size={72} color={Palette.success} />
        <Text style={styles.title}>
          {importedCount} vêtement{importedCount > 1 ? 's' : ''} ajouté{importedCount > 1 ? 's' : ''}
        </Text>
        <Text style={styles.sub}>
          Le type et la couleur viennent du nom des articles : vérifie-les dans l’onglet Dressing.
        </Text>
        <Pressable style={[styles.primary, { alignSelf: 'stretch' }]} onPress={onDone}>
          <Text style={styles.primaryText}>Terminer</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const renderShop = (s: Shop) => (
    <Pressable key={s.id} style={styles.shopRow} onPress={() => openShop(s)}>
      <ShopLogo shop={s} size={44} />
      <Text style={styles.shopName}>{s.name}</Text>
      <MaterialCommunityIcons name="chevron-right" size={24} color={Palette.textSecondary} />
    </Pressable>
  );

  // ---------- Accueil de l'import ----------
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <MaterialCommunityIcons name={standalone ? 'close' : 'arrow-left'} size={26} color={Palette.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.bigTitle}>{standalone ? 'Importer depuis une boutique' : 'Importe tes achats'}</Text>
        <Text style={styles.sub}>
          Retrouve tes vêtements déjà commandés pour remplir ton dressing plus vite. Tu te connectes toi-même
          sur le site de la boutique : l’app ne voit ni ton mot de passe, ni tes identifiants. Elle lit seulement
          les images et les noms d’articles de la page affichée, quand tu le demandes.
        </Text>

        {favorites.length > 0 && (
          <>
            {standalone && <Text style={styles.sectionLabel}>Tes boutiques</Text>}
            {favorites.map(renderShop)}
          </>
        )}

        {others.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{favorites.length > 0 ? 'Autres boutiques' : 'Boutiques'}</Text>
            {others.map(renderShop)}
          </>
        )}

        {!standalone && favorites.length === 0 && (
          <Text style={styles.sub}>Tu n’as choisi aucune boutique. Tu pourras en importer plus tard depuis l’onglet Dressing.</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.primary, standalone && styles.ghost]} onPress={standalone ? onBack : onDone}>
          <Text style={[styles.primaryText, standalone && styles.ghostText]}>
            {standalone ? 'Fermer' : 'Commencer sans importer'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  header: { padding: 16 },
  body: { padding: 20, gap: 12 },
  bigTitle: { fontSize: 28, fontWeight: '700', color: Palette.text },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: Palette.text },
  sub: { color: Palette.textSecondary, fontSize: 15, textAlign: 'left' },
  sectionLabel: { fontSize: 15, fontWeight: '700', marginTop: 8, color: Palette.text },
  shopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Palette.surface, borderColor: Palette.border, borderWidth: 1, borderRadius: 16, padding: 12,
  },
  shopName: { flex: 1, fontSize: 17, fontWeight: '600', color: Palette.text },
  footer: { padding: 20 },
  primary: { backgroundColor: Palette.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: Palette.onAccent, fontSize: 16, fontWeight: '700' },
  ghost: { backgroundColor: Palette.surfaceRaised },
  ghostText: { color: Palette.text },
});
