import { useState } from 'react';
import { Modal } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RoundAction } from '@/components/RoundAction';
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
      <RoundAction icon="storefront" label="Importer" onPress={openImport} />

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => { console.log('[cycle] onRequestClose'); close(); }}
        onDismiss={() => console.log('[cycle] Modal fermé côté iOS')}
      >
        {/* Rendu seulement quand la fenêtre est ouverte : l'état de l'import repart de zéro à chaque fois */}
        <SafeAreaProvider>
          {open && <ShopImport standalone shopIds={favoriteIds} onBack={close} onDone={close} />}
        </SafeAreaProvider>
      </Modal>
    </>
  );
}

