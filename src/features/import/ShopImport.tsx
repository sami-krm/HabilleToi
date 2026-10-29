import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLifecycleLog } from '@/utils/lifecycleLog';
import { Palette } from '@/constants/theme';
import ShopLogo from '@/features/onboarding/ShopLogo';
import { SHOPS, type Shop } from '@/features/onboarding/profile';
import { loadCustomShops, saveCustomShops, shopFromInput, siteExists } from '@/storage/customShops';
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

  // Sites ajoutés par l'utilisateur, absents de la liste
  const [customShops, setCustomShops] = useState<Shop[]>([]);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [checking, setChecking] = useState(false);
  useEffect(() => { loadCustomShops().then(setCustomShops); }, []);

  const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = fold(query.trim());
  const matches = (s: Shop) => !q || fold(s.name).includes(q) || s.domain.includes(q);
  const favorites = SHOPS.filter((s) => shopIds.includes(s.id) && matches(s));
  const others = standalone ? SHOPS.filter((s) => !shopIds.includes(s.id) && matches(s)) : [];
  const mine = customShops.filter(matches);

  const addCustomShop = async () => {
    const shop = shopFromInput(newUrl, newName);
    if (!shop) { setAddError('Adresse invalide. Exemple : www.monsite.fr'); return; }
    const known = [...SHOPS, ...customShops].find((s) => s.domain === shop.domain);
    if (known) { setAddError(`${known.name} est déjà dans la liste.`); return; }
    setChecking(true);
    const exists = await siteExists(shop);
    setChecking(false);
    if (!exists) { setAddError(`Le site ${shop.domain} ne répond pas. Vérifie l’adresse.`); return; }
    const next = [...customShops, shop];
    setCustomShops(next);
    await saveCustomShops(next);
    setAdding(false); setNewUrl(''); setNewName(''); setAddError(''); setQuery('');
  };

  const removeCustomShop = (shop: Shop) => Alert.alert(`Retirer ${shop.name} ?`, 'Le site ne sera plus proposé pour l’import.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Retirer', style: 'destructive', onPress: async () => {
      const next = customShops.filter((s) => s.id !== shop.id);
      setCustomShops(next);
      await saveCustomShops(next);
    } },
  ]);

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

  const renderShop = (s: Shop, custom = false) => (
    <Pressable key={s.id} style={styles.shopRow} onPress={() => openShop(s)} onLongPress={custom ? () => removeCustomShop(s) : undefined}>
      <ShopLogo shop={s} size={44} />
      <View style={styles.shopTexts}>
        <Text style={styles.shopName}>{s.name}</Text>
        {custom && <Text style={styles.shopDomain}>{s.domain} · appui long pour retirer</Text>}
      </View>
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

        <View style={styles.search}>
          <MaterialCommunityIcons name="magnify" size={20} color={Palette.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher une boutique"
            placeholderTextColor={Palette.textSecondary}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Effacer la recherche">
              <MaterialCommunityIcons name="close-circle" size={18} color={Palette.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {favorites.length > 0 && (
          <>
            {standalone && <Text style={styles.sectionLabel}>Tes boutiques</Text>}
            {favorites.map((s) => renderShop(s))}
          </>
        )}

        {mine.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Mes sites</Text>
            {mine.map((s) => renderShop(s, true))}
          </>
        )}

        {/* Ajout d'un site absent de la liste */}
        {adding ? (
          <View style={styles.addCard}>
            <Text style={styles.addTitle}>Ajouter un site</Text>
            <TextInput
              style={styles.addInput}
              value={newUrl}
              onChangeText={(t) => { setNewUrl(t); setAddError(''); }}
              placeholder="Adresse du site (ex. www.monsite.fr)"
              placeholderTextColor={Palette.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
            />
            <TextInput
              style={styles.addInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Nom (facultatif)"
              placeholderTextColor={Palette.textSecondary}
              returnKeyType="done"
              onSubmitEditing={addCustomShop}
            />
            {addError ? <Text style={styles.addError}>{addError}</Text> : null}
            <View style={styles.addActions}>
              <Pressable style={[styles.addBtn, styles.ghost]} onPress={() => { setAdding(false); setAddError(''); }}>
                <Text style={[styles.addBtnText, styles.ghostText]}>Annuler</Text>
              </Pressable>
              <Pressable style={[styles.addBtn, (!newUrl.trim() || checking) && styles.addBtnOff]} disabled={!newUrl.trim() || checking} onPress={addCustomShop}>
                {checking ? <ActivityIndicator color={Palette.onAccent} /> : <Text style={styles.addBtnText}>Ajouter</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.addRow} onPress={() => { setAdding(true); if (q.includes('.')) setNewUrl(query.trim()); }}>
            <View style={styles.addIcon}><MaterialCommunityIcons name="plus" size={22} color={Palette.white} /></View>
            <View style={styles.shopTexts}>
              <Text style={styles.shopName}>Ajouter un site</Text>
              <Text style={styles.shopDomain}>Ta boutique n’est pas dans la liste ?</Text>
            </View>
          </Pressable>
        )}

        {others.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{favorites.length > 0 ? 'Autres boutiques' : 'Boutiques'}</Text>
            {others.map((s) => renderShop(s))}
          </>
        )}

        {q && favorites.length + others.length + mine.length === 0 && (
          <Text style={styles.sub}>Aucune boutique ne correspond. Ajoute-la avec « Ajouter un site ».</Text>
        )}

        {!standalone && favorites.length === 0 && mine.length === 0 && !q && (
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
  shopTexts: { flex: 1, gap: 2 },
  shopName: { fontSize: 17, fontWeight: '600', color: Palette.text },
  shopDomain: { fontSize: 13, color: Palette.textSecondary },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Palette.surface, borderRadius: 999, paddingHorizontal: 16, height: 48, marginTop: 4,
  },
  searchInput: { flex: 1, color: Palette.text, fontSize: 16, height: '100%' },
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Palette.surfaceSelected,
  },
  addIcon: { width: 44, height: 44, borderRadius: 11, backgroundColor: Palette.accent, alignItems: 'center', justifyContent: 'center' },
  addCard: { backgroundColor: Palette.surface, borderRadius: 20, padding: 16, gap: 10 },
  addTitle: { color: Palette.text, fontSize: 17, fontWeight: '700' },
  addInput: { backgroundColor: Palette.surfaceRaised, borderRadius: 14, paddingHorizontal: 14, height: 48, color: Palette.text, fontSize: 15 },
  addError: { color: Palette.danger, fontSize: 13 },
  addActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  addBtn: { flex: 1, backgroundColor: Palette.accent, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  addBtnOff: { opacity: 0.4 },
  addBtnText: { color: Palette.onAccent, fontWeight: '700', fontSize: 15 },
  footer: { padding: 20 },
  primary: { backgroundColor: Palette.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: Palette.onAccent, fontSize: 16, fontWeight: '700' },
  ghost: { backgroundColor: Palette.surfaceRaised },
  ghostText: { color: Palette.text },
});
