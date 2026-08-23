import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function ExploreScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>OralCare AI</Text>
          <Text style={styles.section}>CLINICAL ARCHITECTURE</Text>
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
          <Text style={styles.cardTitle}>MobileNetV2 Neural Engine</Text>
          <Text style={styles.cardText}>
            Deep learning transfer model running inference on preprocessed 224x224 mucosal imagery, generating probabilistic risk categories.
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
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 18,
    letterSpacing: 0.5,
  },
});
