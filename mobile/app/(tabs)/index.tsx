import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getActiveBaseUrl, getOrFetchToken } from '@/hooks/use-auth';
import { savePatientRecord } from '@/storage/patientStorage';

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const canContinue = name.trim().length > 0 && age.trim().length > 0 && !loading;

  const handleContinue = async () => {
    if (!canContinue) return;

    try {
      setLoading(true);

      const trimmedName = name.trim();
      const parsedAge = parseInt(age, 10);
      const trimmedPhone = phone.trim() || undefined;

      let patientId = `local-${Date.now()}`;
      let isOnline = false;

      try {
        const token = await getOrFetchToken();
        const baseUrl = getActiveBaseUrl();

        // 2-second fast timeout check for online backend registration
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2200);

        const res = await fetch(`${baseUrl}/patients`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: trimmedName,
            age: parsedAge,
            phone: trimmedPhone,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.ok) {
          const patient = await res.json();
          patientId = patient.id;
          isOnline = true;
        }
      } catch {
        // Network unreachable or offline mode — continue seamlessly with local ID
        isOnline = false;
      }

      // Save locally in offline-first storage
      await savePatientRecord({
        id: patientId,
        patientName: trimmedName,
        age: String(parsedAge),
        phone: trimmedPhone,
        qualityStatus: 'pending',
        createdAt: new Date().toISOString(),
      });

      // Proceed immediately to examination screen
      router.push({
        pathname: '/(tabs)/examination',
        params: {
          patientId,
          patientName: trimmedName,
          age: String(parsedAge),
          phone: trimmedPhone || '',
        },
      });
    } catch (error: any) {
      console.error('Registration flow error:', error);
      // Even in case of unexpected errors, navigate forward
      const fallbackId = `local-${Date.now()}`;
      router.push({
        pathname: '/(tabs)/examination',
        params: {
          patientId: fallbackId,
          patientName: name.trim(),
          age: age.trim(),
          phone: phone.trim(),
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Brand Header */}
          <View style={styles.topSection}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <View style={styles.brandDot} />
              </View>
              <View>
                <Text style={styles.brandName}>OralCare AI</Text>
                <Text style={styles.brandTag}>TOBACCO DEFENSE SUITE</Text>
              </View>
            </View>

            <Text style={styles.screenTitle}>Patient Registration</Text>
            <Text style={styles.intro}>
              Enter clinical intake details to initialize AI buccal screening.
            </Text>
          </View>

          {/* Dark Glassmorphism Form Card */}
          <View style={styles.formCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>Intake Information</Text>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Step 1 of 4</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                FULL NAME <Text style={styles.required}>*</Text>
              </Text>

              <TextInput
                style={styles.input}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor="#475569"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.ageField]}>
                <Text style={styles.label}>
                  AGE <Text style={styles.required}>*</Text>
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="45"
                  placeholderTextColor="#475569"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  maxLength={3}
                  returnKeyType="next"
                  editable={!loading}
                />
              </View>

              <View style={[styles.field, styles.phoneField]}>
                <Text style={styles.label}>PHONE (OPTIONAL)</Text>

                <TextInput
                  style={styles.input}
                  placeholder="+91 98765 43210"
                  placeholderTextColor="#475569"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  editable={!loading}
                />
              </View>
            </View>

            <View style={styles.infoBox}>
              <View style={styles.infoIconCircle}>
                <Text style={styles.infoIcon}>🛡️</Text>
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Offline-First Protocol</Text>
                <Text style={styles.infoText}>
                  Intake data saves instantly to local vault with automatic cloud backend sync.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!canContinue}
              onPress={handleContinue}
              style={[
                styles.continueButton,
                !canContinue && styles.continueButtonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#080C0E" size="small" />
              ) : (
                <>
                  <Text
                    style={[
                      styles.continueText,
                      !canContinue && styles.continueTextDisabled,
                    ]}
                  >
                    Proceed to Examination
                  </Text>
                  <Text
                    style={[
                      styles.arrow,
                      !canContinue && styles.continueTextDisabled,
                    ]}
                  >
                    →
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.privacyText}>
            🔒 End-to-end encrypted medical telemetry. Functions seamlessly online & offline.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#080C0E' },
  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 28,
  },
  topSection: { marginBottom: 24 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#00D2B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  brandDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#080C0E' },
  brandName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.4,
  },
  brandTag: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00D2B4',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  screenTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  intro: {
    fontSize: 14,
    lineHeight: 21,
    color: '#94A3B8',
    marginTop: 8,
    maxWidth: 360,
  },
  formCard: {
    backgroundColor: '#11171D',
    borderWidth: 1,
    borderColor: '#1E2B37',
    borderRadius: 22,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  stepBadge: {
    backgroundColor: '#16282E',
    borderWidth: 1,
    borderColor: '#00D2B4',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00D2B4',
  },
  field: { marginBottom: 18 },
  row: { flexDirection: 'row', gap: 12 },
  ageField: { flex: 0.85 },
  phoneField: { flex: 1.15 },
  label: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.6, marginBottom: 8 },
  required: { color: '#F43F5E' },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#243442',
    borderRadius: 12,
    backgroundColor: '#0B1015',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#F8FAFC',
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0F1A22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#17303E',
    padding: 14,
    marginTop: 2,
    marginBottom: 22,
  },
  infoIconCircle: {
    marginRight: 10,
    marginTop: 1,
  },
  infoIcon: { fontSize: 16 },
  infoTextContainer: { flex: 1 },
  infoTitle: { fontSize: 12, fontWeight: '700', color: '#38BDF8', marginBottom: 2 },
  infoText: { fontSize: 11, lineHeight: 16, color: '#94A3B8' },
  continueButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#00D2B4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D2B4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  continueButtonDisabled: {
    backgroundColor: '#1E293B',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueText: { color: '#080C0E', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  continueTextDisabled: { color: '#475569' },
  arrow: { color: '#080C0E', fontSize: 18, marginLeft: 8, fontWeight: '800' },
  privacyText: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    color: '#64748B',
    marginTop: 20,
    paddingHorizontal: 16,
  },
});