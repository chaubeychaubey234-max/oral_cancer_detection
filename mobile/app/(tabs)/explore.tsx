import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getActiveBaseUrl, getOrFetchToken, setCustomHost } from '@/hooks/use-auth';

export default function ExploreScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    setServerUrl(getActiveBaseUrl());
    testServer(getActiveBaseUrl());
  }, []);

  const testServer = async (urlToTest?: string) => {
    const target = (urlToTest || serverUrl).trim().replace(/\/+$/, '');
    if (!target) return;
    setChecking(true);
    try {
      const ok = await setCustomHost(target);
      setConnected(ok);
      if (ok) {
        setServerUrl(target);
      }
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  };

  const handleSaveAndConnect = async () => {
    const target = serverUrl.trim().replace(/\/+$/, '');
    if (!target) {
      Alert.alert('Invalid URL', 'Please enter a valid backend server URL.');
      return;
    }
    setChecking(true);
    const ok = await setCustomHost(target);
    setChecking(false);
    setConnected(ok);
    if (ok) {
      Alert.alert('Connected ✓', `Successfully connected to backend:\n${target}`);
    } else {
      Alert.alert('Connection Failed', `Could not reach ${target}.\nPlease check if server is running or ngrok URL is active.`);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>OralCare AI</Text>
          <Text style={styles.section}>CLINICAL ARCHITECTURE & TELEMETRY</Text>
        </View>

        {/* Live Server Host Manager */}
        <View style={styles.serverCard}>
          <View style={styles.serverHeader}>
            <Text style={styles.serverBadge}>BACKEND CONNECTION</Text>
            <View style={[styles.statusDot, connected ? styles.dotGreen : styles.dotAmber]} />
          </View>
          <Text style={styles.serverTitle}>Active Inference Server</Text>
          <Text style={styles.serverDesc}>
            Enter your local LAN IP or online ngrok/public tunnel URL for live TensorFlow neural model evaluation:
          </Text>

          <TextInput
            style={styles.serverInput}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://10.35.130.75:8000 or https://xyz.ngrok-free.app"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.btnRow}>
            <Pressable
              style={[styles.testBtn, checking && { opacity: 0.6 }]}
              onPress={handleSaveAndConnect}
              disabled={checking}
            >
              {checking ? (
                <ActivityIndicator color="#080C0E" size="small" />
              ) : (
                <Text style={styles.testBtnText}>Connect & Save Server</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.autoBtn}
              onPress={async () => {
                setChecking(true);
                await getOrFetchToken();
                setServerUrl(getActiveBaseUrl());
                setConnected(true);
                setChecking(false);
                Alert.alert('Auto-Detected', `Connected to: ${getActiveBaseUrl()}`);
              }}
            >
              <Text style={styles.autoBtnText}>Auto-Detect</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.title}>System Architecture</Text>
        <Text style={styles.subtitle}>
          End-to-end multi-agent AI pipeline for early oral pre-malignant detection.
        </Text>

        {/* Feature Cards */}
        <View style={styles.card}>
          <Text style={styles.cardBadge}>MEMBER A</Text>
          <Text style={styles.cardTitle}>Mobile Telemetry & Client</Text>
          <Text style={styles.cardText}>
            React Native + Expo Native Android APK with camera guided alignment HUD, offline caching, and real-time backend sync.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardBadge}>MEMBER B</Text>
          <Text style={styles.cardTitle}>OpenCV Quality Matrix</Text>
          <Text style={styles.cardText}>
            Real-time optical evaluation calculating Laplacian variance for blur, pixel luminance for brightness, glare percentage, and mucosa centering.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardBadge}>MEMBER C</Text>
          <Text style={styles.cardTitle}>Fine-tuned V1 Neural Engine</Text>
          <Text style={styles.cardText}>
            Deep learning transfer model running inference on preprocessed 224x224 mucosal imagery with Grad-CAM heatmap telemetry.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardBadge}>MEMBER D</Text>
          <Text style={styles.cardTitle}>FastAPI & Clinical Dashboard</Text>
          <Text style={styles.cardText}>
            JWT-authenticated REST API with SQLite database, doctor review queue, and override audit logging.
          </Text>
        </View>

        <Text style={styles.footer}>
          OralCare AI • TobaccoShield Hackathon Release v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#080C0E' },
  container: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 40 },
  header: { marginBottom: 20 },
  brand: { fontSize: 16, fontWeight: '800', color: '#F8FAFC' },
  section: { fontSize: 9, fontWeight: '700', color: '#00D2B4', letterSpacing: 1.1, marginTop: 2 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: '#94A3B8', marginTop: 6, lineHeight: 19, marginBottom: 22 },
  serverCard: {
    backgroundColor: '#0F1923',
    borderWidth: 1,
    borderColor: '#00D2B440',
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
  },
  serverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  serverBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00D2B4',
    letterSpacing: 1.1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: {
    backgroundColor: '#00D2B4',
  },
  dotAmber: {
    backgroundColor: '#F59E0B',
  },
  serverTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  serverDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 14,
  },
  serverInput: {
    backgroundColor: '#080C0E',
    borderWidth: 1,
    borderColor: '#1E2B37',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  testBtn: {
    flex: 2,
    backgroundColor: '#00D2B4',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: {
    color: '#080C0E',
    fontSize: 13,
    fontWeight: '800',
  },
  autoBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#11171D',
    borderWidth: 1,
    borderColor: '#1E2B37',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  cardBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00D2B4',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 6,
  },
  cardText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#94A3B8',
  },
  footer: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '600',
  },
});
