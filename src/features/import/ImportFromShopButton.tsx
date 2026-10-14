import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { Palette } from '@/constants/theme';
import { loadProfile } from '@/features/onboarding/profile';
import { useLifecycleLog } from '@/utils/lifecycleLog';
import ShopImport from './ShopImport';

/** Bouton « Importer » (onglet Dressing) : ouvre l'import depuis une boutique dans une fenêtre plein écran. */
export default function ImportFromShopButton({ onImported }: { onImported: () => void }) {
  useLifecycleLog('Bouton import');
  const [open, setOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const openImport = async () => {
    const profile = await loadProfile();
    setFavoriteIds(profile?.shops ?? []); // boutiques choisies au questionnaire
    setOpen(true);
  };

  // À la fermeture, on demande à l'écran Dressing de recharger la liste
  const close = () => {
    console.log('[cycle] close() appelée');
    setOpen(false);
    onImported();
  };

  return (
    <>
      <Pressable style={styles.btn} onPress={openImport}>
        <MaterialCommunityIcons name="storefront-outline" size={18} color={Palette.onAccent} />
        <Text style={styles.btnText}>Importer</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => { console.log('[cycle] onRequestClose'); close(); }}
        onDismiss={() => console.log('[cycle] Modal fermé côté iOS')}
      >
        {/* Rendu seulement quand la fenêtre est ouverte : l'état de l'import repart de zéro à chaque fois */}
        {open && <ShopImport standalone shopIds={favoriteIds} onBack={close} onDone={close} />}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Palette.accent, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16,
  },
  btnText: { color: Palette.onAccent, fontWeight: '600' },
});