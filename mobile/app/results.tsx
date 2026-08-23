import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    caseId?: string;
    patientName?: string;
    status?: string;
    qualityPassed?: string;
    qualityReason?: string;
    qualityAllFailed?: string;
    blurScore?: string;
    brightnessScore?: string;
    glareAreaPct?: string;
    framingConfidence?: string;
    riskCategory?: string;
    confidence?: string;
    cannotAssess?: string;
    cannotAssessReason?: string;
    modelVersion?: string;
  }>();

  const patientName = params.patientName ?? 'Clinical Subject';
  const qualityPassed = params.qualityPassed === 'true';
  const cannotAssess = params.cannotAssess === 'true';
  const riskCategory = params.riskCategory ?? '';
  const confidence = params.confidence ? parseFloat(params.confidence) : null;
  const blurScore = params.blurScore ? parseFloat(params.blurScore) : null;
  const brightnessScore = params.brightnessScore ? parseFloat(params.brightnessScore) : null;
  const glareAreaPct = params.glareAreaPct ? parseFloat(params.glareAreaPct) : null;
  const framingConfidence = params.framingConfidence ? parseFloat(params.framingConfidence) : null;
  let failedReasons: string[] = [];
  try {
    failedReasons = JSON.parse(params.qualityAllFailed ?? '[]');
  } catch { /* noop */ }

  const { label: riskLabel, color: riskColor, bgColor, borderColor, description } = getRiskInfo(
    riskCategory, cannotAssess
  );

  const handleDone = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>OralCare AI</Text>
            <Text style={styles.section}>CLINICAL DIAGNOSTICS</Text>
          </View>
          <Pressable style={styles.completeBadge} onPress={handleDone}>
            <Text style={styles.completeBadgeText}>Complete ✓</Text>
          </Pressable>
        </View>

        {/* Patient Pill */}
        <View style={styles.patientRow}>
          <View style={styles.patientIcon}>
            <Text style={styles.patientIconText}>{patientName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.patientInfo}>
            <Text style={styles.patientLabel}>PATIENT RECORD</Text>
            <Text style={styles.patientName}>{patientName}</Text>
          </View>
        </View>

        {/* Risk Assessment Hero */}
        <View
          style={[
            styles.riskCard,
            { backgroundColor: bgColor, borderColor },
          ]}
        >
          <Text style={styles.riskEmoji}>{getRiskEmoji(riskCategory, cannotAssess)}</Text>
          <Text style={[styles.riskLabel, { color: riskColor }]}>{riskLabel}</Text>
          <Text style={styles.riskDesc}>{description}</Text>

          {confidence !== null && !cannotAssess ? (
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>Neural Model Confidence</Text>
              <Text style={[styles.confidenceValue, { color: riskColor }]}>
                {(confidence * 100).toFixed(1)}%
              </Text>
            </View>
          ) : null}

          {params.modelVersion ? (
            <Text style={styles.modelVer}>Architecture: {params.modelVersion}</Text>
          ) : null}
        </View>

        {/* OpenCV Quality Audit Matrix */}
        <View style={styles.qualityCard}>
          <Text style={styles.qualityTitle}>OpenCV Quality Matrix</Text>

          <QualityRow
            label="Overall Assessment"
            value={qualityPassed ? 'PASSED ✓' : 'FLAGGED ⚠️'}
            valueColor={qualityPassed ? '#00D2B4' : '#F43F5E'}
          />

          {blurScore !== null ? (
            <QualityRow
              label="Laplacian Blur Score"
              value={blurScore.toFixed(2)}
              valueColor={blurScore >= 100 ? '#00D2B4' : '#F43F5E'}
              info="Target: > 100.0"
            />
          ) : null}

          {brightnessScore !== null ? (
            <QualityRow
              label="Illumination Index"
              value={brightnessScore.toFixed(2)}
              valueColor={brightnessScore >= 0.25 && brightnessScore <= 200 ? '#00D2B4' : '#F59E0B'}
              info="Target: 0.25 – 0.85"
            />
          ) : null}

          {glareAreaPct !== null ? (
            <QualityRow
              label="Reflective Glare"
              value={`${glareAreaPct.toFixed(1)}%`}
              valueColor={glareAreaPct <= 5.0 ? '#00D2B4' : '#F43F5E'}
              info="Target: < 5.0%"
            />
          ) : null}

          {framingConfidence !== null ? (
            <QualityRow
              label="Viewfinder Alignment"
              value={`${(framingConfidence * 100).toFixed(0)}%`}
              valueColor="#00D2B4"
              info="Mucosa centring"
            />
          ) : null}

          {failedReasons.length > 0 ? (
            <View style={styles.failedBox}>
              <Text style={styles.failedBoxTitle}>Quality Warnings Noted:</Text>
              {failedReasons.map((r, i) => (
                <Text key={i} style={styles.failedReason}>• {r}</Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* Case ID banner */}
        {params.caseId ? (
          <View style={styles.caseInfo}>
            <Text style={styles.caseInfoText}>TELEMETRY ID: {params.caseId}</Text>
          </View>
        ) : null}

        {/* Action buttons */}
        <Pressable style={styles.doneBtn} onPress={handleDone}>
          <Text style={styles.doneBtnText}>Initialize New Screening →</Text>
        </Pressable>

        <Pressable
          style={styles.archiveBtn}
          onPress={() => router.push('/(tabs)/patient-history')}
        >
          <Text style={styles.archiveBtnText}>View in Patient Archive 📋</Text>
        </Pressable>

        <Text style={styles.footer}>
          ⚠️ AI-assisted triage tool. Clinical findings require validation by a certified oncologist or dental surgeon.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function QualityRow({
  label, value, valueColor, info,
}: {
  label: string; value: string; valueColor?: string; info?: string;
}) {
  return (
    <View style={qrStyles.row}>
      <View style={qrStyles.left}>
        <Text style={qrStyles.label}>{label}</Text>
        {info ? <Text style={qrStyles.info}>{info}</Text> : null}
      </View>
      <Text style={[qrStyles.value, valueColor ? { color: valueColor } : { color: '#F8FAFC' }]}>{value}</Text>
    </View>
  );
}

function getRiskEmoji(cat: string, cannotAssess: boolean) {
  if (cannotAssess || !cat) return '🔍';
  const c = cat.toLowerCase();
  if (c === 'low') return '🛡️';
  if (c === 'medium' || c === 'moderate') return '⚠️';
  return '🚨';
}

function getRiskInfo(cat: string, cannotAssess: boolean) {
  if (cannotAssess || !cat) {
    return {
      label: 'Cannot Assess',
      color: '#38BDF8',
      bgColor: '#0C1A24',
      borderColor: '#0284C7',
      description:
        'Optical capture does not meet medical quality thresholds. Re-align with adequate illumination.',
    };
  }
  const c = cat.toLowerCase();
  if (c === 'low') {
    return {
      label: 'Low Risk',
      color: '#00D2B4',
      bgColor: '#0A1C18',
      borderColor: '#00D2B4',
      description:
        'No malignant or pre-cancerous lesion patterns detected in this region. Maintain routine screening.',
    };
  }
  if (c === 'medium' || c === 'moderate') {
    return {
      label: 'Moderate Risk',
      color: '#F59E0B',
      bgColor: '#1F1708',
      borderColor: '#D97706',
      description:
        'Mucosal atypical changes detected. Recommend clinical examination and in-person doctor follow-up.',
    };
  }
  return {
    label: 'High Risk Indicator',
    color: '#F43F5E',
    bgColor: '#210B10',
    borderColor: '#E11D48',
    description:
      'Significant mucosal lesion features identified. Urgent specialist oncological consultation recommended.',
  };
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#080C0E' },
  container: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  brand: { fontSize: 16, fontWeight: '800', color: '#F8FAFC' },
  section: { fontSize: 9, fontWeight: '700', color: '#00D2B4', letterSpacing: 1.1, marginTop: 2 },
  completeBadge: {
    backgroundColor: '#16282E',
    borderWidth: 1,
    borderColor: '#00D2B4',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  completeBadgeText: {
    color: '#00D2B4',
    fontSize: 11,
    fontWeight: '700',
  },
  patientRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#11171D', borderRadius: 16,
    borderWidth: 1, borderColor: '#1E2B37', padding: 14, marginBottom: 18,
  },
  patientIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: '#00D2B4',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  patientIconText: { fontSize: 18, fontWeight: '900', color: '#080C0E' },
  patientInfo: { flex: 1 },
  patientLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', letterSpacing: 0.8 },
  patientName: { fontSize: 16, fontWeight: '800', color: '#F8FAFC', marginTop: 2 },

  riskCard: {
    borderRadius: 22, borderWidth: 1.5, padding: 24,
    alignItems: 'center', marginBottom: 18,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 8,
  },
  riskEmoji: { fontSize: 44, marginBottom: 10 },
  riskLabel: { fontSize: 26, fontWeight: '900', marginBottom: 8, letterSpacing: -0.4 },
  riskDesc: { fontSize: 13, lineHeight: 20, color: '#94A3B8', textAlign: 'center', maxWidth: 320 },
  confidenceRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', marginTop: 18, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  confidenceLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  confidenceValue: { fontSize: 15, fontWeight: '800' },
  modelVer: { fontSize: 10, color: '#64748B', marginTop: 10, letterSpacing: 0.5 },

  qualityCard: {
    backgroundColor: '#11171D', borderRadius: 18,
    borderWidth: 1, borderColor: '#1E2B37', padding: 18, marginBottom: 16,
  },
  qualityTitle: { fontSize: 15, fontWeight: '700', color: '#F1F5F9', marginBottom: 12 },
  failedBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1E2B37' },
  failedBoxTitle: { fontSize: 11, fontWeight: '700', color: '#F43F5E', marginBottom: 6, letterSpacing: 0.5 },
  failedReason: { fontSize: 11, color: '#F43F5E', lineHeight: 18, fontWeight: '600' },

  caseInfo: { alignItems: 'center', marginBottom: 10 },
  caseInfoText: { fontSize: 10, color: '#64748B', letterSpacing: 0.8, fontWeight: '600' },

  doneBtn: {
    height: 54, borderRadius: 14, backgroundColor: '#00D2B4',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowColor: '#00D2B4', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
  },
  doneBtnText: { fontSize: 15, fontWeight: '800', color: '#080C0E', letterSpacing: 0.3 },

  archiveBtn: {
    height: 50, borderRadius: 14, backgroundColor: '#16232D',
    borderWidth: 1, borderColor: '#1E3A4C',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  archiveBtnText: { fontSize: 14, fontWeight: '700', color: '#38BDF8', letterSpacing: 0.2 },

  footer: {
    fontSize: 10, color: '#475569', textAlign: 'center',
    lineHeight: 16, paddingHorizontal: 12, fontWeight: '500',
  },
});

const qrStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#161F28',
  },
  left: { flex: 1 },
  label: { fontSize: 13, color: '#CBD5E1', fontWeight: '600' },
  info: { fontSize: 10, color: '#64748B', marginTop: 2 },
  value: { fontSize: 13, fontWeight: '700', marginLeft: 12 },
});
