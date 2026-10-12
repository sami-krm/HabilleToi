import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useWardrobe } from '@/hooks/useWardrobe';
import { loadFavorites, saveFavorites } from '@/storage/wardrobeStorage';
import type { FavoriteOutfit } from '@/types';

export default function FavoritesView() {
  const [favorites, setFavorites] = useState<FavoriteOutfit[]>([]);
  const { items, reload } = useWardrobe();

  // Recharge favoris et dressing à chaque retour sur l'onglet
  useFocusEffect(
    useCallback(() => {
      reload();
      loadFavorites().then(setFavorites);
    }, [reload]),
  );

  const removeFavorite = async (id: string) => {
    const next = favorites.filter((f) => f.id !== id);
    setFavorites(next);
    await saveFavorites(next);
  };

  const confirmRemove = (id: string) =>
    Alert.alert('Retirer cette tenue des favoris ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => removeFavorite(id) },
    ]);

  return (
    <View style={styles.safe}>
      <FlatList
        // Les plus récentes en premier
        data={[...favorites].sort((a, b) => b.createdAt - a.createdAt)}
        keyExtractor={(f) => f.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.title}>Mes tenues favorites ({favorites.length})</Text>}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Aucun favori pour l'instant. Appuie sur « Favori » dans l'onglet Tenue pour en enregistrer un.
          </Text>
        }
        renderItem={({ item: fav }) => {
          // Vêtements encore présents dans le dressing (certains ont pu être supprimés)
          const pieces = fav.itemIds
            .map((id) => items.find((i) => i.id === id))
            .filter((i) => i !== undefined);
          const hasDirty = pieces.some((p) => !p.clean);
          const missing = fav.itemIds.length - pieces.length;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.date}>{new Date(fav.createdAt).toLocaleDateString('fr-FR')}</Text>
                <Pressable onPress={() => confirmRemove(fav.id)} hitSlop={10}>
                  <MaterialCommunityIcons name="trash-can-outline" size={22} color="#8a4b2a" />
                </Pressable>
              </View>

              <View style={styles.pieces}>
                {pieces.map((p) => (
                  <View key={p.id} style={styles.piece}>
                    <Image source={{ uri: p.uri }} style={[styles.img, !p.clean && styles.imgDirty]} />
                    <Text style={styles.pieceLabel} numberOfLines={1}>{p.type}</Text>
                  </View>
                ))}
              </View>

              {hasDirty && <Text style={styles.note}>Contient des vêtements sales.</Text>}
              {missing > 0 && (
                <Text style={styles.note}>
                  {missing} vêtement{missing > 1 ? 's' : ''} supprimé{missing > 1 ? 's' : ''} du dressing.
                </Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 20, gap: 12, paddingBottom: 140 }, // marge basse : barre d'onglets flottante
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  empty: { color: '#666', marginTop: 24 },
  card: { backgroundColor: '#f6f6f6', borderRadius: 14, padding: 12, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: '#666' },
  pieces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  piece: { width: 72 },
  img: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#e5e5e5' },
  imgDirty: { opacity: 0.4 },
  pieceLabel: { fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
  note: { color: '#a15c00', fontSize: 13 },
});