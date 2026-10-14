import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { Glass, Palette } from '@/constants/theme';
import { addDemoWardrobe, removeDemoWardrobe } from './demoWardrobe';

/** Bouton réservé au développement : ajoute ou retire des vêtements de test. */
export default function DemoDataButton({ onChanged }: { onChanged: () => void }) {
  if (!__DEV__) return null;

  const choose = () =>
    Alert.alert(
      'Vêtements de test',
      'Ajoute 35 vêtements factices pour tester les tenues. Tes vrais vêtements ne sont pas touchés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer les tests',
          style: 'destructive',
          onPress: async () => { await removeDemoWardrobe(); onChanged(); },
        },
        {
          text: 'Ajouter',
          onPress: async () => { await addDemoWardrobe(); onChanged(); },
        },
      ],
    );

  return (
    <Pressable style={styles.btn} onPress={choose}>
      <MaterialCommunityIcons name="flask-outline" size={18} color={Palette.accent} />
      <Text style={styles.text}>Tests</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    ...Glass, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
  },
  text: { color: Palette.text, fontWeight: '600' },
});