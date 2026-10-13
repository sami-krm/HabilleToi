import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

/** Fond « aurore » : trois taches pastel adoucies par un flou. */
export default function AuroraBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.blob, { top: -60, left: -70, width: 300, height: 300, backgroundColor: '#FFD2B8' }]} />
      <View style={[styles.blob, { top: 120, right: -90, width: 300, height: 300, backgroundColor: '#CFC6FF' }]} />
      <View style={[styles.blob, { bottom: 80, left: -60, width: 260, height: 260, backgroundColor: '#BFF0DE' }]} />
      <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', borderRadius: 999 },
});