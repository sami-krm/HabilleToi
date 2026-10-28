import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, Keyboard, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Palette } from '@/constants/theme';
import type { Shop } from '@/features/onboarding/profile';
import { EXTRACT_SCRIPT, type RawItem } from './importUtils';

// Mets false pour tester : aucune session n'est alors effacée à la fermeture (moins de risques de boucle de connexion)
const PRIVATE_MODE = true;

// Seules ces adresses restent dans l'app ; les liens du type « zara://... » ouvriraient l'app de la boutique
const allowRequest = (url: string) => /^(https?:|about:|data:|blob:)/i.test(url);

interface Props {
  shop: Shop;
  foundCount: number;
  onItems: (items: RawItem[]) => number; // renvoie le nombre de nouveaux articles
  onClose: () => void;
  onReview: () => void;
}

export default function ShopBrowser({ shop, foundCount, onItems, onClose, onReview }: Props) {
  const webRef = useRef<WebView>(null);
  const [guideOpen, setGuideOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  // Si ces lignes réapparaissent dans le terminal pendant la saisie, l'écran a été recréé
  useEffect(() => {
    const subs = [
      Keyboard.addListener('keyboardWillShow', () => console.log('[cycle] clavier visible')),
      Keyboard.addListener('keyboardDidHide', () => console.log('[cycle] clavier masqué')),
      AppState.addEventListener('change', (s) => console.log('[cycle] AppState =', s)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  const analyze = () => {
    setStatus('Analyse de la page…');
    webRef.current?.injectJavaScript(EXTRACT_SCRIPT);
  };

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'items') {
        const added = onItems(msg.items as RawItem[]);
        setStatus(
          added > 0
            ? `${added} nouvel${added > 1 ? 's' : ''} article${added > 1 ? 's' : ''} trouvé${added > 1 ? 's' : ''}.`
            : "Aucun nouvel article. Ouvre la liste de tes commandes et fais défiler la page avant de réessayer.",
        );
      } else {
        setStatus("Cette page n'a pas pu être analysée.");
      }
    } catch {
      setStatus("Cette page n'a pas pu être analysée.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={26} color={Palette.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{shop.name}</Text>
        <Pressable onPress={() => setGuideOpen((o) => !o)} hitSlop={12}>
          <MaterialCommunityIcons name={guideOpen ? 'chevron-up' : 'help-circle-outline'} size={26} color={Palette.text} />
        </Pressable>
      </View>

      {/* Guide pas à pas */}
      {guideOpen && (
        <View style={styles.guide}>
          <Text style={styles.guideTitle}>Comment importer</Text>
          <Text style={styles.guideLine}>1. Connecte-toi à ton compte {shop.name}. Tes identifiants restent sur le site : l’app ne les voit pas.</Text>
          <Text style={styles.guideLine}>2. Ouvre « Mes commandes » (ou « Historique d’achats »).</Text>
          <Text style={styles.guideLine}>3. Fais défiler la liste pour charger toutes les images, puis touche « Analyser cette page ».</Text>
          <Text style={styles.guideLine}>4. Répète sur d’autres pages si besoin, puis touche « Voir les articles ».</Text>
        </View>
      )}

      <View style={styles.web}>
        <WebView
          ref={webRef}
          source={{ uri: shop.url }}
          incognito={PRIVATE_MODE} // aucune session conservée après la fermeture
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['https://*', 'http://*']}
          applicationNameForUserAgent="Version/17.5 Mobile/15E148 Safari/604.1" // se présente comme Safari
          allowsLinkPreview={false}
          onShouldStartLoadWithRequest={(req) => {
            if (allowRequest(req.url)) return true;
            setStatus("Le site a voulu ouvrir son application : redirection bloquée.");
            return false;
          }}
          // La page web a manqué de mémoire : on la recharge au lieu de la laisser vide
          onContentProcessDidTerminate={() => webRef.current?.reload()}
          onRenderProcessGone={() => webRef.current?.reload()}
          onError={() => setStatus("Cette page n'a pas pu se charger. Vérifie ta connexion.")}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onMessage={onMessage}
        />
        {loading && (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator />
          </View>
        )}
      </View>

      <View style={styles.bar}>
        {status && <Text style={styles.status}>{status}</Text>}
        <View style={styles.barRow}>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={analyze}>
            <MaterialCommunityIcons name="text-search" size={18} color={Palette.text} />
            <Text style={styles.btnGhostText}>Analyser cette page</Text>
          </Pressable>
          <Pressable style={[styles.btn, foundCount === 0 && styles.btnDisabled]}
            disabled={foundCount === 0} onPress={onReview}>
            <Text style={styles.btnText}>Voir les articles ({foundCount})</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 12 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Palette.text },
  guide: { backgroundColor: Palette.accentSoft, marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 12, gap: 4 },
  guideTitle: { fontWeight: '700', marginBottom: 2, color: Palette.text },
  guideLine: { color: Palette.textSecondary, fontSize: 13 },
  web: { flex: 1 },
  loader: { position: 'absolute', top: 12, alignSelf: 'center' },
  bar: { padding: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.border },
  barRow: { flexDirection: 'row', gap: 8 },
  status: { color: Palette.textSecondary, fontSize: 13 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Palette.accent, paddingVertical: 12, borderRadius: 14,
  },
  btnDisabled: { backgroundColor: Palette.surfaceSelected, opacity: 0.55 },
  btnText: { color: Palette.onAccent, fontWeight: '600' },
  btnGhost: { backgroundColor: Palette.surfaceRaised },
  btnGhostText: { color: Palette.text, fontWeight: '600' },
});
