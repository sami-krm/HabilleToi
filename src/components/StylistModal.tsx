import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import AuroraScreen from '@/components/AuroraScreen';
import { GlassCard } from '@/components/GlassCard';
import { Palette } from '@/constants/theme';
import { askStylist, isStylistConfigured } from '@/services/stylistService';
import type { ClothingItem, Weather } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  items: ClothingItem[];
  weather: Weather | null;
}

const EXAMPLES = ['Que mettre pour un entretien ?', 'Un mariage en octobre ?', 'Une soirée décontractée ?'];

export default function StylistModal({ visible, onClose, items, weather }: Props) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError('');
    setAnswer('');
    try {
      setAnswer(await askStylist(trimmed, items, weather ?? undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de contacter l’assistant.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <AuroraScreen>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.topRow}>
              <View>
                <Text style={styles.title}>Assistant styliste</Text>
                <Text style={styles.subtitle}>Une occasion, ton dressing, une idée de tenue.</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fermer">
                <MaterialCommunityIcons name="close" size={26} color={Palette.text} />
              </Pressable>
            </View>

            <GlassCard style={styles.card}>
              <Text style={styles.label}>Quelle est l’occasion ?</Text>
              <TextInput
                style={styles.input}
                value={question}
                onChangeText={setQuestion}
                placeholder="Que mettre pour un entretien ?"
                placeholderTextColor={Palette.textSecondary}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={submit}
              />
              <View style={styles.examples}>
                {EXAMPLES.map((example) => (
                  <Pressable key={example} style={styles.example} onPress={() => setQuestion(example)}>
                    <Text style={styles.exampleText}>{example}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={[styles.askButton, busy && styles.disabled]} onPress={submit} disabled={busy || !question.trim()}>
                {busy ? <ActivityIndicator color={Palette.onAccent} /> : <MaterialCommunityIcons name="creation" size={19} color={Palette.onAccent} />}
                <Text style={styles.askText}>{busy ? 'Gemini réfléchit…' : 'Proposer une tenue'}</Text>
              </Pressable>
              <Text style={styles.privacy}>
                {isStylistConfigured()
                  ? `${items.length} pièces transmises sous forme de texte, sans leurs photos.`
                  : 'La connexion Gemini doit être configurée côté serveur pour activer les suggestions.'}
              </Text>
            </GlassCard>

            {!!error && <GlassCard style={styles.answerCard}><Text style={styles.error}>{error}</Text></GlassCard>}
            {!!answer && <GlassCard style={styles.answerCard}><Text style={styles.answerTitle}>Ta suggestion</Text><Text style={styles.answer}>{answer}</Text></GlassCard>}
          </ScrollView>
        </KeyboardAvoidingView>
      </AuroraScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, gap: 16, paddingBottom: 50 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  title: { color: Palette.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: Palette.textSecondary, marginTop: 3 },
  card: { gap: 12 },
  label: { color: Palette.text, fontWeight: '700' },
  input: { minHeight: 80, borderRadius: 14, padding: 14, backgroundColor: 'rgba(255,255,255,0.65)', color: Palette.text, textAlignVertical: 'top' },
  examples: { gap: 8 },
  example: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.55)' },
  exampleText: { color: Palette.textSecondary, fontSize: 13, fontWeight: '600' },
  askButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 14, borderRadius: 16, backgroundColor: Palette.ink },
  disabled: { opacity: 0.55 },
  askText: { color: Palette.onAccent, fontWeight: '800' },
  privacy: { color: Palette.textSecondary, fontSize: 12, lineHeight: 17 },
  answerCard: { gap: 8 },
  answerTitle: { color: Palette.text, fontWeight: '800', fontSize: 17 },
  answer: { color: Palette.text, lineHeight: 22 },
  error: { color: Palette.danger, lineHeight: 20 },
});
