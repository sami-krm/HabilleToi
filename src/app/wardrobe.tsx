import AuroraScreen from '@/components/AuroraScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { Palette } from '@/constants/theme';
import ImportFromShopButton from '@/features/import/ImportFromShopButton';
import { useWardrobe } from '@/hooks/useWardrobe';
import { recognizeClothing } from '@/services/clothingRecognition';
import type { ClothingItem, ClothingType, ColorName, Style } from '@/types';
import { allColors } from '@/types';

// ---------- Données d'affichage ----------
const TYPES: { key: ClothingType; label: string }[] = [
  { key: 'tshirt', label: 'T-shirt' },
  { key: 'chemise', label: 'Chemise' },
  { key: 'pull', label: 'Pull' },
  { key: 'veste', label: 'Veste' },
  { key: 'pantalon', label: 'Pantalon' },
  { key: 'short', label: 'Short' },
  { key: 'chaussures', label: 'Chaussures' },
];

const STYLES: { key: Style; label: string }[] = [
  { key: 'casual', label: 'Casual' },
  { key: 'sport', label: 'Sport' },
  { key: 'formel', label: 'Formel' },
  { key: 'soiree', label: 'Soirée' },
];

const COLORS: Record<ColorName, string> = {
  noir: '#111111', blanc: '#FFFFFF', gris: '#9E9E9E', beige: '#D8C3A5',
  marine: '#1F2A44', marron: '#6B4423', bleu: '#2F6FED', rouge: '#D32F2F',
  vert: '#2E8B57', jaune: '#F4C430', orange: '#F57C00', rose: '#F48FB1', violet: '#7E57C2',
};

// Onglets de catégories (libellés au pluriel)
type Category = ClothingType | 'all';
const CATEGORY_TABS: { key: Category; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'tshirt', label: 'T-shirts' },
  { key: 'chemise', label: 'Chemises' },
  { key: 'pull', label: 'Pulls' },
  { key: 'veste', label: 'Vestes' },
  { key: 'pantalon', label: 'Pantalons' },
  { key: 'short', label: 'Shorts' },
  { key: 'chaussures', label: 'Chaussures' },
];

type StateFilter = 'all' | 'clean' | 'dirty';
const STATE_OPTIONS: { key: StateFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'clean', label: 'Propres' },
  { key: 'dirty', label: 'Sales' },
];

const MAX_COLORS = 3;

const typeLabel = (t: ClothingType) => TYPES.find((x) => x.key === t)?.label ?? t;

// ---------- Petit composant de sélection ----------
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
    </Pressable>
  );
}

export default function WardrobeScreen() {
  const { items, reload, addItem, removeItem, updateItem, setClean } = useWardrobe();

  // ----- Filtres et catégories -----
  const [category, setCategory] = useState<Category>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [styleFilter, setStyleFilter] = useState<Style | null>(null);
  const [colorFilter, setColorFilter] = useState<ColorName | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount =
    (stateFilter !== 'all' ? 1 : 0) + (styleFilter ? 1 : 0) + (colorFilter ? 1 : 0);

  const resetFilters = () => {
    setCategory('all');
    setStateFilter('all');
    setStyleFilter(null);
    setColorFilter(null);
  };

  // Un vêtement passe-t-il les filtres actuels ? (withCategory=false : on ignore l'onglet, pour les compteurs)
  const matchesFilters = (item: ClothingItem, withCategory = true) => {
    if (withCategory && category !== 'all' && item.type !== category) return false;
    if (stateFilter === 'clean' && !item.clean) return false;
    if (stateFilter === 'dirty' && item.clean) return false;
    if (styleFilter && !item.styles.includes(styleFilter)) return false;
    if (colorFilter && !allColors(item).includes(colorFilter)) return false;
    return true;
  };

  const baseItems = items.filter((i) => matchesFilters(i, false));
  const visible = baseItems.filter((i) => category === 'all' || i.type === category);
  const countOf = (key: Category) =>
    key === 'all' ? baseItems.length : baseItems.filter((i) => i.type === key).length;

  // ----- Formulaire (ajout ou modification) : s'ouvre quand draftUri n'est pas null -----
  const [editingId, setEditingId] = useState<string | null>(null); // null = ajout d'un nouveau vêtement
  const [draftUri, setDraftUri] = useState<string | null>(null);
  const [type, setType] = useState<ClothingType>('tshirt');
  const [selColors, setSelColors] = useState<ColorName[]>(['noir']); // la 1re = couleur principale
  const [selStyles, setSelStyles] = useState<Style[]>(['casual']);
  const [pattern, setPattern] = useState<'uni' | 'motif'>('uni');

  // Reconnaissance automatique (uniquement à l'ajout)
  const [analyzing, setAnalyzing] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const requestId = useRef(0); // ignore les réponses d'une photo abandonnée

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Lance la reconnaissance et pré-remplit le formulaire avec la suggestion
  const runRecognition = async (base64: string, mimeType: string) => {
    const id = ++requestId.current;
    setAnalyzing(true);
    setAiApplied(false);
    setAiFailed(false);
    try {
      const s = await recognizeClothing(base64, mimeType);
      if (id !== requestId.current) return; // la fenêtre a été fermée ou une autre photo choisie
      if (s) {
        if (s.type) setType(s.type);
        if (s.colors) setSelColors(s.colors);
        if (s.pattern) setPattern(s.pattern);
        if (s.styles) setSelStyles(s.styles);
        setAiApplied(true);
      }
    } catch (e) {
      console.warn(e); // le message apparaît dans le terminal d'Expo
      if (id === requestId.current) setAiFailed(true);
    } finally {
      if (id === requestId.current) setAnalyzing(false);
    }
  };

  const closeForm = () => {
    requestId.current++; // invalide une analyse en cours
    setAnalyzing(false);
    setEditingId(null);
    setDraftUri(null);
  };

  // Ouvre le formulaire pré-rempli avec un vêtement existant
  const openEdit = (item: ClothingItem) => {
    requestId.current++;
    setAnalyzing(false);
    setAiApplied(false);
    setAiFailed(false);
    setEditingId(item.id);
    setType(item.type);
    setSelColors(allColors(item));
    setSelStyles(item.styles);
    setPattern(item.pattern);
    setDraftUri(item.uri); // ouvre la fenêtre
  };

  // Prise de photo ou import galerie (nouveau vêtement)
  const pickImage = async (source: 'camera' | 'library') => {
    try {
      // base64: true : nécessaire pour envoyer l'image à la reconnaissance
      const options: ImagePicker.ImagePickerOptions = {
        quality: 0.4, allowsEditing: true, aspect: [1, 1], base64: true,
      };
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Caméra refusée', 'Autorise la caméra dans les réglages pour photographier tes vêtements.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        // Le sélecteur de photos système ne demande pas de permission
        result = await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ['images'] });
      }
      if (result.canceled) return;

      const asset = result.assets[0];

      // Réinitialise le formulaire avant d'ouvrir la fenêtre
      setEditingId(null);
      setType('tshirt'); setSelColors(['noir']); setSelStyles(['casual']); setPattern('uni');
      setAiApplied(false); setAiFailed(false);
      setDraftUri(asset.uri);

      if (asset.base64) runRecognition(asset.base64, asset.mimeType ?? 'image/jpeg');
    } catch {
      Alert.alert('Indisponible', 'Caméra indisponible (simulateur ?). Utilise la galerie.');
    }
  };

  const toggleStyle = (s: Style) =>
    setSelStyles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  // Ajoute ou retire une couleur (au moins une, au plus MAX_COLORS)
  const toggleColor = (c: ColorName) =>
    setSelColors((prev) => {
      if (prev.includes(c)) return prev.length > 1 ? prev.filter((x) => x !== c) : prev;
      return prev.length >= MAX_COLORS ? prev : [...prev, c];
    });

  const save = async () => {
    if (!draftUri) return;
    const fields = {
      type, pattern,
      color: selColors[0],
      extraColors: selColors.slice(1),
      styles: selStyles.length > 0 ? selStyles : (['casual'] as Style[]),
    };

    // Modification d'un vêtement existant : la photo et l'état propre/sale ne changent pas
    if (editingId) {
      await updateItem(editingId, fields);
      closeForm();
      return;
    }

    // Nouveau vêtement
    const id = String(Date.now());

    // Copie la photo dans le stockage permanent de l'app (sinon le fichier temporaire peut disparaître)
    let uri = draftUri;
    try {
      const dest = new File(Paths.document, `${id}.jpg`);
      new File(draftUri).copy(dest);
      uri = dest.uri;
    } catch {
      // En cas d'échec, on garde l'URI d'origine
    }

    const newItem: ClothingItem = { id, uri, clean: true, ...fields };
    await addItem(newItem);
    // Si les filtres cachaient le vêtement qu'on vient d'ajouter, on les efface pour qu'il soit visible
    if (!matchesFilters(newItem)) resetFilters();
    closeForm();
  };

  // Suppression (avec confirmation) + effacement de la photo stockée par l'app
  const confirmDelete = () => {
    const item = items.find((i) => i.id === editingId);
    if (!item) return;
    Alert.alert(
      'Supprimer ce vêtement ?',
      `${typeLabel(item.type)} · ${item.color}\nCette action est définitive.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await removeItem(item.id);
            try {
              // On ne supprime que les photos copiées dans le stockage de l'app
              if (item.uri.startsWith(Paths.document.uri)) {
                const file = new File(item.uri);
                if (file.exists) file.delete();
              }
            } catch {
              // fichier déjà absent ou non supprimable : sans conséquence
            }
            closeForm();
          },
        },
      ],
    );
  };

  return (
    <AuroraScreen>
      {/* Titre et boutons d'ajout */}
      <View style={styles.top}>
        <Text style={styles.title}>
          Mon dressing ({visible.length}
          {visible.length !== items.length ? ` sur ${items.length}` : ''})
        </Text>
        <View style={styles.actions}>
          <Pressable style={styles.btn} onPress={() => pickImage('camera')}>
            <MaterialCommunityIcons name="camera-outline" size={18} color={Palette.onAccent} />
            <Text style={styles.btnText}>Photo</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={() => pickImage('library')}>
            <MaterialCommunityIcons name="image-outline" size={18} color={Palette.onAccent} />
            <Text style={styles.btnText}>Galerie</Text>
          </Pressable>
          <ImportFromShopButton onImported={reload} />
        </View>
      </View>

      {/* Onglets de catégories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabs}
      >
        {CATEGORY_TABS.map((t) => {
          const active = category === t.key;
          return (
            <Pressable key={t.key} onPress={() => setCategory(t.key)} style={[styles.tab, active && styles.tabActive]}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              <Text style={[styles.tabCount, active && styles.tabCountActive]}>{countOf(t.key)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Barre de filtres */}
      <View style={styles.filterBar}>
        <Pressable style={styles.filterBtn} onPress={() => setShowFilters((s) => !s)}>
          <MaterialCommunityIcons name="filter-variant" size={18} color={Palette.text} />
          <Text style={styles.filterBtnText}>Filtres</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
          <MaterialCommunityIcons name={showFilters ? 'chevron-up' : 'chevron-down'} size={18} color={Palette.text} />
        </Pressable>
        {(activeFilterCount > 0 || category !== 'all') && (
          <Pressable onPress={resetFilters} hitSlop={8}>
            <Text style={styles.link}>Réinitialiser</Text>
          </Pressable>
        )}
      </View>

      {/* Panneau de filtres : état, occasion, couleur */}
      {showFilters && (
        <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
          <Text style={styles.panelLabel}>État</Text>
          <View style={styles.chips}>
            {STATE_OPTIONS.map((o) => (
              <Chip key={o.key} label={o.label} active={stateFilter === o.key} onPress={() => setStateFilter(o.key)} />
            ))}
          </View>

          <Text style={styles.panelLabel}>Occasion</Text>
          <View style={styles.chips}>
            <Chip label="Toutes" active={styleFilter === null} onPress={() => setStyleFilter(null)} />
            {STYLES.map((s) => (
              <Chip key={s.key} label={s.label} active={styleFilter === s.key} onPress={() => setStyleFilter(s.key)} />
            ))}
          </View>

          <Text style={styles.panelLabel}>Couleur</Text>
          <View style={styles.swatches}>
            {(Object.keys(COLORS) as ColorName[]).map((c) => (
              <Pressable
                key={c}
                onPress={() => setColorFilter((cur) => (cur === c ? null : c))} // retoucher la couleur la désélectionne
                style={styles.swatchWrap}
              >
                <View style={[styles.swatch, { backgroundColor: COLORS[c] }, colorFilter === c && styles.swatchActive]} />
                <Text style={styles.swatchLabel}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          items.length === 0 ? (
            <Text style={styles.empty}>Ton dressing est vide. Ajoute un premier vêtement avec « Photo » ou « Galerie ».</Text>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>Aucun vêtement ne correspond à ces filtres.</Text>
              <Pressable style={[styles.btn, styles.btnGhost, { alignSelf: 'flex-start' }]} onPress={resetFilters}>
                <Text style={styles.btnGhostText}>Réinitialiser les filtres</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable style={[styles.card, !item.clean && styles.cardDirty]} onPress={() => openEdit(item)}>
            <Image source={{ uri: item.uri }} style={styles.cardImg} />
            <View style={styles.cardInfo}>
              {allColors(item).map((c) => (
                <View key={c} style={[styles.dot, { backgroundColor: COLORS[c] }]} />
              ))}
              <Text style={styles.cardLabel} numberOfLines={1}>{typeLabel(item.type)}</Text>
            </View>
            <Pressable
              style={[styles.cleanBtn, item.clean ? styles.cleanOk : styles.cleanKo]}
              onPress={() => setClean([item.id], !item.clean)}
            >
              <MaterialCommunityIcons
                name={item.clean ? 'check-circle-outline' : 'washing-machine'}
                size={16}
                color={Palette.white}
              />
              <Text style={styles.cleanText}>{item.clean ? 'Propre' : 'Sale · marquer lavé'}</Text>
            </Pressable>
          </Pressable>
        )}
      />

      {/* Fenêtre d'ajout / de modification : type, couleurs, style, motif */}
      <Modal visible={draftUri !== null} animationType="slide" onRequestClose={closeForm}>
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.form}>
            <Text style={styles.formTitle}>{editingId ? 'Modifier le vêtement' : 'Nouveau vêtement'}</Text>

            {draftUri && <Image source={{ uri: draftUri }} style={styles.preview} />}

            {/* Bandeau de reconnaissance automatique (ajout uniquement) */}
            {analyzing && (
              <View style={styles.banner}>
                <ActivityIndicator size="small" />
                <Text style={styles.bannerText}>Analyse du vêtement en cours…</Text>
              </View>
            )}
            {aiApplied && !analyzing && (
              <View style={styles.banner}>
                <MaterialCommunityIcons name="creation" size={18} color={Palette.accent} />
                <Text style={styles.bannerText}>Suggestion automatique : vérifie et corrige si besoin.</Text>
              </View>
            )}
            {aiFailed && !analyzing && (
              <Text style={styles.note}>Reconnaissance indisponible, remplis les champs à la main.</Text>
            )}

            <Text style={styles.label}>Type</Text>
            <View style={styles.chips}>
              {TYPES.map((t) => <Chip key={t.key} label={t.label} active={type === t.key} onPress={() => setType(t.key)} />)}
            </View>

            <Text style={styles.label}>Couleurs</Text>
            <Text style={styles.hintInline}>
              Touche jusqu'à {MAX_COLORS} couleurs. Le numéro 1 est la couleur principale.
            </Text>
            <View style={styles.swatches}>
              {(Object.keys(COLORS) as ColorName[]).map((c) => {
                const rank = selColors.indexOf(c); // -1 si non sélectionnée
                return (
                  <Pressable key={c} onPress={() => toggleColor(c)} style={styles.swatchWrap}>
                    <View>
                      <View style={[styles.swatch, { backgroundColor: COLORS[c] }, rank >= 0 && styles.swatchActive]} />
                      {rank >= 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{rank + 1}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.swatchLabel}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Occasions</Text>
            <View style={styles.chips}>
              {STYLES.map((s) => (
                <Chip key={s.key} label={s.label} active={selStyles.includes(s.key)} onPress={() => toggleStyle(s.key)} />
              ))}
            </View>

            <Text style={styles.label}>Motif</Text>
            <View style={styles.chips}>
              <Chip label="Uni" active={pattern === 'uni'} onPress={() => setPattern('uni')} />
              <Chip label="À motifs" active={pattern === 'motif'} onPress={() => setPattern('motif')} />
            </View>

            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={closeForm}>
                <Text style={styles.btnGhostText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={save}>
                <Text style={styles.btnText}>Enregistrer</Text>
              </Pressable>
            </View>

            {/* Suppression : uniquement en modification */}
            {editingId && (
              <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={Palette.danger} />
                <Text style={styles.deleteText}>Supprimer ce vêtement</Text>
              </Pressable>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </AuroraScreen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  top: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: Palette.text },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  link: { color: Palette.accent, fontWeight: '600' },

  // Onglets de catégories
  tabsScroll: { flexGrow: 0, flexShrink: 0, height: 44, marginTop: 12 },
  tabs: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Palette.surfaceRaised,
  },
  tabActive: { backgroundColor: Palette.surfaceSelected },
  tabText: { color: Palette.textSecondary, fontWeight: '600' },
  tabTextActive: { color: Palette.accent },
  tabCount: { color: Palette.textSecondary, fontSize: 12, fontWeight: '600' },
  tabCountActive: { color: Palette.accent },

  // Filtres
  filterBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: Palette.surfaceRaised,
  },
  filterBtnText: { fontWeight: '600', color: Palette.text },
  filterBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: Palette.accent, alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { color: Palette.onAccent, fontSize: 11, fontWeight: '700' },
  panel: { maxHeight: 280, marginHorizontal: 20, marginBottom: 8, backgroundColor: Palette.surface, borderRadius: 16, borderWidth: 1, borderColor: Palette.border },
  panelContent: { padding: 14, gap: 10 },
  panelLabel: { fontWeight: '600', fontSize: 14, marginTop: 4, color: Palette.text },

  // Liste
  list: { padding: 20, gap: 12, paddingBottom: 140 }, // marge basse : barre d'onglets flottante
  row: { gap: 12 },
  empty: { color: Palette.textSecondary },
  emptyBox: { gap: 12, marginTop: 24 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Palette.accent, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16,
  },
  btnText: { color: Palette.onAccent, fontWeight: '600' },
  btnGhost: { backgroundColor: Palette.surfaceRaised },
  btnGhostText: { color: Palette.text, fontWeight: '600' },
  card: { flex: 1, backgroundColor: Palette.surface, borderRadius: 18, padding: 8, gap: 6, borderWidth: 1, borderColor: Palette.border },
  cardDirty: { opacity: 0.6 },
  cardImg: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: Palette.surfaceRaised },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: Palette.hairline },
  cardLabel: { flexShrink: 1, marginLeft: 2, color: Palette.text },
  cleanBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8 },
  cleanOk: { backgroundColor: '#247A5C' },
  cleanKo: { backgroundColor: '#77512F' },
  cleanText: { color: Palette.white, fontSize: 12, fontWeight: '600' },

  // Formulaire
  form: { padding: 20, gap: 12, paddingBottom: 40 },
  formTitle: { fontSize: 22, fontWeight: '700', color: Palette.text },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 18, backgroundColor: Palette.surfaceRaised },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Palette.accentSoft, borderRadius: 14, padding: 12,
  },
  bannerText: { flexShrink: 1, color: Palette.text },
  note: { color: Palette.warning },
  hintInline: { color: Palette.textSecondary, fontSize: 13, marginTop: -6 },
  label: { fontSize: 16, fontWeight: '600', marginTop: 8, color: Palette.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Palette.surfaceRaised },
  chipActive: { backgroundColor: Palette.accent },
  chipText: { color: Palette.textSecondary },
  chipTextActive: { color: Palette.onAccent },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatchWrap: { alignItems: 'center', width: 56 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: Palette.hairline },
  swatchActive: { borderWidth: 3, borderColor: Palette.accent },
  swatchLabel: { fontSize: 11, marginTop: 2, color: Palette.textSecondary },
  badge: {
    position: 'absolute', top: -4, right: -6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: Palette.accent, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: Palette.onAccent, fontSize: 11, fontWeight: '700' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: Palette.danger,
  },
  deleteText: { color: Palette.danger, fontWeight: '600' },
});
