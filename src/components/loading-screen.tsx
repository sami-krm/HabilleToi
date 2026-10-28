import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import AuroraBackground from '@/components/AuroraBackground';
import { Glass, Palette } from '@/constants/theme';

const APP_NAME = 'Tenue du jour'; // à adapter

export default function LoadingScreen() {
  const [pulse] = useState(() => new Animated.Value(0));

  // Icône qui « respire »
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <View style={styles.container}>
      <AuroraBackground />
      <Animated.View style={[styles.logo, { transform: [{ scale }] }]}>
        <MaterialCommunityIcons name="hanger" size={64} color={Palette.accent} />
      </Animated.View>
      <Text style={styles.name}>{APP_NAME}</Text>
      <Text style={styles.tagline}>On regarde la météo…</Text>
      <ActivityIndicator color={Palette.accent} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.background, alignItems: 'center', justifyContent: 'center', gap: 8 },
  logo: {
    ...Glass, width: 120, height: 120, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  name: { color: Palette.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { color: Palette.textSecondary, fontSize: 16 },
  spinner: { marginTop: 24 },
});
