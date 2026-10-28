import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { Shop } from './profile';
import { Palette } from '@/constants/theme';

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

  // Fond blanc : les logos noirs restent lisibles sur le thème sombre
  return (
    <View style={[styles.plate, { width: size, height: size, borderRadius: radius }]}>
      <Image
        source={{ uri: `https://www.google.com/s2/favicons?domain=${shop.domain}&sz=128` }}
        style={{ width: size * 0.72, height: size * 0.72 }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fallback: { backgroundColor: Palette.accentSoft, alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '700', color: Palette.accent },
});
