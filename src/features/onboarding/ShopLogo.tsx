import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { Shop } from './profile';

/** Logo récupéré via le favicon du site ; initiales si le chargement échoue. */
export default function ShopLogo({ shop, size = 56 }: { shop: Shop; size?: number }) {
  const [failed, setFailed] = useState(false);
  const radius = size / 4;

  if (failed) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}>
        <Text style={styles.initials}>{shop.name.slice(0, 2).toUpperCase()}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: `https://www.google.com/s2/favicons?domain=${shop.domain}&sz=128` }}
      style={{ width: size, height: size, borderRadius: radius }}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: '#e8f1ff', alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '700', color: '#2F6FED' },
});