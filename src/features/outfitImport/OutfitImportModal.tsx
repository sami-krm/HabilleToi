import { MaterialCommunityIcons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import AuroraScreen from '@/components/AuroraScreen';
import { COLOR_HEX, TYPE_LABELS } from '@/constants/clothing';
import { Palette } from '@/constants/theme';
import { analyzeOutfitPhoto, cropPiece, type DetectedPiece } from '@/services/outfitAI';
import { loadWardrobe, saveWardrobe } from '@/storage/wardrobeStorage';
import type { ClothingItem } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface Photo { uri: string; base64: string; mime: string; width: number; height: number }

interface Piece extends DetectedPiece {
  key: string;
  selected: boolean;
  shot: 'pending' | 'done' | 'failed';
  shotUri?: string;
  shotError?: string;
}


/** Import d'une photo de tenue : chaque pièce repérée devient un vêtement du dressing. */
export default function OutfitImportModal({ visible, onClose, onImported }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Monté seulement quand la fenêtre est ouverte : tout repart de zéro à chaque fois */}
      {visible && <OutfitImport onClose={onClose} onImported={onImported} />}
    </Modal>
  );
}

function OutfitImport({ onClose, onImported }: Omit<Props, 'visible'>) {
  const [phase, setPhase] = useState<'pick' | 'analyzing' | 'review' | 'saving'>('pick');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [error, setError] = useState('');
  const alive = useRef(true);
  // Remis à vrai à chaque montage : un rechargement de l'app ou le mode strict relance les effets
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const patchPiece = (key: string, patch: Partial<Piece>) =>
    setPieces((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  /** Découpe chaque pièce dans la photo, sur le téléphone. */
  const cropAll = async (list: Piece[], source: Photo) => {
    for (const piece of list) {
      if (!alive.current) return;
      if (!piece.box) { patchPiece(piece.key, { shot: 'failed', shotError: 'Position de la pièce inconnue : la photo entière sera utilisée.' }); continue; }
      try {
        const uri = await cropPiece(source.uri, source.width, source.height, piece.box);
        if (alive.current) patchPiece(piece.key, { shot: 'done', shotUri: uri });
      } catch (e) {
        if (alive.current) patchPiece(piece.key, { shot: 'failed', shotError: e instanceof Error ? e.message : undefined });
      }
    }
  };

  /** Relance le découpage d'une seule pièce. */
  const retryShot = (piece: Piece) => {
    if (!photo) return;
    patchPiece(piece.key, { shot: 'pending', shotError: undefined });
    cropAll([piece], photo);
  };

  const pick = async (source: 'camera' | 'library') => {
    setError('');
    const options: ImagePicker.ImagePickerOptions = { quality: 0.6, base64: true, mediaTypes: ['images'] };
    let result: ImagePicker.ImagePickerResult;
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Caméra refusée', 'Autorise la caméra dans les réglages pour photographier ta tenue.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
    } catch {
      Alert.alert('Indisponible', 'Caméra indisponible (simulateur ?). Utilise la galerie.');
      return;
    }
    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    const chosen = { uri: asset.uri, base64: asset.base64 ?? '', mime: asset.mimeType ?? 'image/jpeg', width: asset.width, height: asset.height };
    setPhoto(chosen);
    setPhase('analyzing');
    try {
      const detected = await analyzeOutfitPhoto(chosen.base64, chosen.mime);
      if (!alive.current) return;
      if (detected.length === 0) {
        setError('Aucun vêtement repéré sur cette photo. Essaie une photo en pied, bien éclairée.');
        setPhase('pick');
        return;
      }
      const list = detected.map((d, i): Piece => ({ ...d, key: `${Date.now()}-${i}`, selected: true, shot: 'pending' }));
      setPieces(list);
      setPhase('review');
      cropAll(list, chosen);
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : 'Analyse impossible. Réessaie.');
      setPhase('pick');
    }
  };

  const save = async () => {
    if (!photo) return;
    const chosen = pieces.filter((p) => p.selected);
    setPhase('saving');
    try {
      const now = Date.now();
      const newItems: ClothingItem[] = chosen.map((p, i) => {
        const id = `${now}-${i}`;
        // Pièce découpée si elle est prête, sinon la photo de la tenue
        const source = p.shot === 'done' && p.shotUri ? p.shotUri : photo.uri;
        const extension = source.toLowerCase().split('?')[0].endsWith('.png') ? 'png' : 'jpg';
        const dest = new File(Paths.document, `${id}.${extension}`);
        new File(source).copy(dest);
        return {
          id, uri: dest.uri, type: p.type, color: p.colors[0], extraColors: p.colors.slice(1),
          styles: p.styles, pattern: p.pattern, clean: true,
        };
      });
      const wardrobe = await loadWardrobe();
      await saveWardrobe([...wardrobe, ...newItems]);
      onImported();
      Alert.alert('Ajouté au dressing', `${newItems.length} pièce${newItems.length > 1 ? 's ajoutées' : ' ajoutée'}.`);
      onClose();
    } catch {
      Alert.alert('Enregistrement impossible', 'Les pièces n’ont pas pu être ajoutées. Réessaie.');
      setPhase('review');
    }
  };

  const selectedCount = pieces.filter((p) => p.selected).length;
  const pendingShots = pieces.filter((p) => p.selected && p.shot === 'pending').length;

  return (
    <AuroraScreen variant="hero">
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Photo de tenue</Text>
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8} accessibilityLabel="Fermer">
          <MaterialCommunityIcons name="close" size={22} color={Palette.white} />
        </Pressable>
      </View>

      {phase === 'pick' && (
        <ScrollView contentContainerStyle={styles.body}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.intro}>
            <View style={styles.introIcon}><MaterialCommunityIcons name="human-handsup" size={40} color={Palette.white} /></View>
            <Text style={styles.title}>Ajoute toute ta tenue d’un coup</Text>
            <Text style={styles.subtitle}>
              Prends-toi en photo en pied : l’app repère chaque vêtement et accessoire, puis découpe chaque pièce pour l’afficher comme sur un site de vente.
            </Text>
          </Animated.View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.pickRow}>
            <Pressable style={styles.pickBtn} onPress={() => pick('camera')}>
              <MaterialCommunityIcons name="camera" size={30} color={Palette.text} />
              <Text style={styles.pickText}>Prendre une photo</Text>
            </Pressable>
            <Pressable style={styles.pickBtn} onPress={() => pick('library')}>
              <MaterialCommunityIcons name="image-multiple" size={30} color={Palette.text} />
              <Text style={styles.pickText}>Choisir dans la galerie</Text>
            </Pressable>
          </View>
          <Text style={styles.privacy}>La photo est envoyée à Gemini pour l’analyse. Il faut être connecté à ton compte.</Text>
        </ScrollView>
      )}

      {phase === 'analyzing' && photo && (
        <View style={styles.analyzing}>
          <Image source={{ uri: photo.uri }} style={styles.analyzingPhoto} />
          <View style={styles.analyzingBadge}>
            <ActivityIndicator color={Palette.white} />
            <Text style={styles.analyzingText}>On repère les pièces de ta tenue…</Text>
          </View>
        </View>
      )}

      {(phase === 'review' || phase === 'saving') && (
        <>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.title}>{pieces.length} pièce{pieces.length > 1 ? 's' : ''} trouvée{pieces.length > 1 ? 's' : ''}</Text>
            <Text style={styles.subtitle}>Décoche ce que tu ne veux pas ajouter.</Text>
            <View style={styles.grid}>
              {pieces.map((p, i) => (
                <Animated.View key={p.key} entering={FadeIn.delay(i * 80)} style={styles.cell}>
                  <Pressable onPress={() => patchPiece(p.key, { selected: !p.selected })} style={[styles.card, !p.selected && styles.cardOff]}>
                    <View style={styles.shot}>
                      {p.shot === 'done' && p.shotUri
                        ? <Image source={{ uri: p.shotUri }} style={[styles.shotImg, styles.shotImgPadded]} resizeMode="contain" />
                        : <Image source={{ uri: photo?.uri }} style={[styles.shotImg, styles.shotBlur]} blurRadius={p.shot === 'pending' ? 12 : 0} />}
                      {p.shot === 'pending' && (
                        <View style={styles.shotOverlay}>
                          <ActivityIndicator color={Palette.white} />
                          <Text style={styles.shotOverlayText}>Découpage…</Text>
                        </View>
                      )}
                      <View style={[styles.check, p.selected && styles.checkOn]}>
                        {p.selected && <MaterialCommunityIcons name="check" size={16} color={Palette.white} />}
                      </View>
                    </View>
                    <Text style={styles.cardType}>{TYPE_LABELS[p.type]}</Text>
                    <View style={styles.cardMeta}>
                      {p.colors.map((c) => <View key={c} style={[styles.dot, { backgroundColor: COLOR_HEX[c] }]} />)}
                      <Text style={styles.cardLabel} numberOfLines={1}>{p.label}</Text>
                    </View>
                    {p.shot === 'failed' && (
                      <Pressable onPress={() => retryShot(p)} hitSlop={6}>
                        <Text style={styles.cardWarn} numberOfLines={3}>{p.shotError ?? 'Découpage impossible'}</Text>
                        <Text style={styles.retry}>Réessayer</Text>
                      </Pressable>
                    )}
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </ScrollView>
          <View style={styles.footer}>
            {pendingShots > 0 && <Text style={styles.footerHint}>Encore {pendingShots} pièce{pendingShots > 1 ? 's' : ''} à découper…</Text>}
            <Pressable
              style={[styles.primary, (selectedCount === 0 || phase === 'saving') && styles.primaryOff]}
              disabled={selectedCount === 0 || phase === 'saving'}
              onPress={save}
            >
              {phase === 'saving'
                ? <ActivityIndicator color={Palette.black} />
                : <Text style={styles.primaryText}>Ajouter {selectedCount} pièce{selectedCount > 1 ? 's' : ''} au dressing</Text>}
            </Pressable>
          </View>
        </>
      )}
    </AuroraScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  headerSpacer: { width: 40 },
  headerTitle: { color: Palette.white, fontSize: 17, fontWeight: '700' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 40, gap: 16 },

  intro: { alignItems: 'center', gap: 12, paddingTop: 24, paddingBottom: 8 },
  introIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center' },
  title: { color: Palette.white, fontSize: 26, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  error: { color: Palette.white, backgroundColor: 'rgba(255,107,122,0.22)', borderRadius: 14, padding: 12, overflow: 'hidden' },
  pickRow: { flexDirection: 'row', gap: 12 },
  pickBtn: { flex: 1, alignItems: 'center', gap: 10, paddingVertical: 26, borderRadius: 24, backgroundColor: Palette.surface },
  pickText: { color: Palette.text, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  privacy: { color: Palette.textSecondary, fontSize: 12, textAlign: 'center' },

  analyzing: { flex: 1, padding: 16, gap: 16 },
  analyzingPhoto: { flex: 1, borderRadius: 28, backgroundColor: Palette.surface },
  analyzingBadge: {
    position: 'absolute', alignSelf: 'center', bottom: 48, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12,
  },
  analyzingText: { color: Palette.white, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '47.5%' },
  card: { backgroundColor: Palette.surface, borderRadius: 22, padding: 8, gap: 6 },
  cardOff: { opacity: 0.45 },
  shot: { aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: Palette.studio },
  shotImg: { width: '100%', height: '100%' },
  shotImgPadded: { margin: '6%', width: '88%', height: '88%' },
  shotBlur: { opacity: 0.9 },
  shotOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.35)' },
  shotOverlayText: { color: Palette.white, fontSize: 12, fontWeight: '600' },
  check: {
    position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: Palette.white, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  cardType: { color: Palette.text, fontSize: 15, fontWeight: '700', marginHorizontal: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: 4, marginBottom: 4 },
  cardLabel: { color: Palette.textSecondary, fontSize: 12, flexShrink: 1, marginLeft: 2 },
  cardWarn: { color: Palette.warning, fontSize: 11, marginHorizontal: 4 },
  retry: { color: Palette.accent, fontSize: 12, fontWeight: '700', marginHorizontal: 4, marginTop: 4, marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: Palette.hairline },

  footer: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8, gap: 10 },
  footerHint: { color: Palette.textSecondary, fontSize: 13, textAlign: 'center' },
  primary: { backgroundColor: Palette.white, borderRadius: 999, paddingVertical: 17, alignItems: 'center' },
  primaryOff: { opacity: 0.35 },
  primaryText: { color: Palette.black, fontSize: 16, fontWeight: '700' },
});
