import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  getPatientHistory,
  PatientRecord,
} from '../../storage/patientStorage';

export default function PatientHistoryScreen() {
  const router = useRouter();

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = async () => {
    try {
      const history = await getPatientHistory();
      setPatients(history);
    } catch (error) {
      console.error('Unable to load patient history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reload history automatically every time this tab screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  useEffect(() => {
    loadHistory();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return 'Date unavailable';
    }

    return date.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleOpenResults = (patient: PatientRecord) => {
    if (patient.riskCategory) {
      router.push({
        pathname: '/results',
        params: {
          caseId: patient.caseId || patient.id,
          patientName: patient.patientName,
          status: 'completed',
          qualityPassed: patient.qualityStatus === 'passed' ? 'true' : 'false',
          qualityReason: patient.qualityReason ?? '',
          qualityAllFailed: JSON.stringify(patient.qualityAllFailed ?? []),
          blurScore: String(patient.blurScore ?? ''),
          brightnessScore: String(patient.brightnessScore ?? ''),
          glareAreaPct: String(patient.glareAreaPct ?? ''),
          framingConfidence: String(patient.framingConfidence ?? ''),
          riskCategory: patient.riskCategory,
          confidence: String(patient.confidence ?? ''),
          cannotAssess: patient.cannotAssess ? 'true' : 'false',
          cannotAssessReason: patient.cannotAssessReason ?? '',
          modelVersion: patient.modelVersion ?? '2.0.0-mobilenetv2',
          imageUri: patient.imageUri,
        },
      });
    } else if (patient.imageUri) {
      handleAnalyzeNow(patient);
    }
  };

  const handleAnalyzeNow = (patient: PatientRecord) => {
    if (!patient.imageUri) {
      router.push({
        pathname: '/(tabs)/examination',
        params: {
          patientId: patient.id,
          patientName: patient.patientName,
          age: patient.age,
          phone: patient.phone,
        },
      });
      return;
    }

    router.push({
      pathname: '/quality-check',
      params: {
        patientId: patient.id,
        patientName: patient.patientName,
        age: patient.age,
        phone: patient.phone || '',
        imageUri: patient.imageUri,
      },
    });
  };

  const getRiskDisplay = (cat?: string, confidence?: number) => {
    if (!cat) return null;
    const c = cat.toLowerCase();
    if (c === 'low') {
      return {
        label: 'Low Risk (Normal)',
        color: '#00D2B4',
        bgColor: '#0A1C18',
        borderColor: '#00D2B4',
        icon: '🛡️',
      };
    }
    if (c === 'medium' || c === 'moderate') {
      return {
        label: 'Moderate Risk',
        color: '#F59E0B',
        bgColor: '#1F1708',
        borderColor: '#D97706',
        icon: '⚠️',
      };
    }
    if (c === 'high') {
      return {
        label: 'High Risk Indicator',
        color: '#F43F5E',
        bgColor: '#210B10',
        borderColor: '#E11D48',
        icon: '🚨',
      };
    }
    return {
      label: 'Cannot Assess',
      color: '#38BDF8',
      bgColor: '#0C1A24',
      borderColor: '#0284C7',
      icon: '🔍',
    };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>OralCare AI</Text>
            <Text style={styles.section}>CLINICAL ARCHIVE</Text>
          </View>

          <Pressable
            onPress={() => router.push('/(tabs)')}
            style={styles.backButton}
          >
            <Text style={styles.backText}>+ New Patient</Text>
          </Pressable>
        </View>

        {/* Heading */}
        <View style={styles.heading}>
          <Text style={styles.title}>Patient Archive</Text>
          <Text style={styles.subtitle}>
            Indexed clinical screening records & neural risk evaluations.
          </Text>
        </View>

        {/* Loading state */}
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#00D2B4" />
            <Text style={styles.stateText}>Accessing local secure vault...</Text>
          </View>
        ) : patients.length === 0 ? (

          /* Empty state */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>🗂️</Text>
            </View>

            <Text style={styles.emptyTitle}>No Clinical Records Found</Text>

            <Text style={styles.emptyText}>
              Patients registered during examinations will automatically synchronize to this local storage.
            </Text>

            <Pressable
              onPress={() => router.push('/(tabs)')}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Register First Patient</Text>
              <Text style={styles.arrow}>→</Text>
            </Pressable>
          </View>

        ) : (

          /* Patient list */
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#00D2B4"
              />
            }
          >
            <View style={styles.countRow}>
              <Text style={styles.countText}>
                {patients.length} {patients.length === 1 ? 'RECORD' : 'RECORDS'} CACHED
              </Text>
              <Text style={styles.offlineText}>ENCRYPTED LOCAL</Text>
            </View>

            {patients.map((patient) => {
              const risk = getRiskDisplay(patient.riskCategory, patient.confidence);
              const hasEvaluation = Boolean(patient.riskCategory);

              return (
                <TouchableOpacity
                  key={patient.id}
                  style={[
                    styles.patientCard,
                    hasEvaluation && risk ? { borderColor: `${risk.borderColor}60` } : null,
                  ]}
                  onPress={() => handleOpenResults(patient)}
                  activeOpacity={0.85}
                >
                  {/* Top row */}
                  <View style={styles.patientTop}>
                    <View style={[styles.patientIcon, hasEvaluation && risk ? { backgroundColor: risk.color } : null]}>
                      <Text style={styles.patientIconText}>
                        {patient.patientName
                          ? patient.patientName.charAt(0).toUpperCase()
                          : 'P'}
                      </Text>
                    </View>

                    <View style={styles.patientInfo}>
                      <Text style={styles.patientName}>{patient.patientName}</Text>
                      <Text style={styles.patientId}>ID: {patient.id}</Text>
                    </View>

                    {patient.imageUri ? (
                      <Image source={{ uri: patient.imageUri }} style={styles.thumbnail} />
                    ) : null}
                  </View>

                  <View style={styles.divider} />

                  {/* AI Risk Assessment Box if Evaluated */}
                  {hasEvaluation && risk ? (
                    <View style={[styles.riskBanner, { backgroundColor: risk.bgColor, borderColor: risk.borderColor }]}>
                      <View style={styles.riskBannerLeft}>
                        <Text style={styles.riskBannerIcon}>{risk.icon}</Text>
                        <View>
                          <Text style={[styles.riskBannerLabel, { color: risk.color }]}>{risk.label}</Text>
                          {patient.confidence !== undefined && (
                            <Text style={styles.riskBannerConfidence}>
                              Neural Confidence: {(patient.confidence * 100).toFixed(1)}%
                            </Text>
                          )}
                        </View>
                      </View>
                      <Text style={[styles.riskBannerArrow, { color: risk.color }]}>→</Text>
                    </View>
                  ) : null}

                  {/* Details */}
                  <View style={styles.detailsRow}>
                    <View style={styles.detail}>
                      <Text style={styles.detailLabel}>AGE</Text>
                      <Text style={styles.detailValue}>{patient.age} yrs</Text>
                    </View>

                    <View style={styles.detail}>
                      <Text style={styles.detailLabel}>PHONE</Text>
                      <Text style={styles.detailValue}>{patient.phone || '—'}</Text>
                    </View>

                    <View style={styles.detail}>
                      <Text style={styles.detailLabel}>RECORD DATE</Text>
                      <Text style={styles.detailValue}>{formatDate(patient.createdAt)}</Text>
                    </View>
                  </View>

                  {/* Status Row */}
                  <View style={styles.statusRow}>
                    {patient.qualityStatus === 'passed' ? (
                      <View style={[styles.statusBadge, styles.statusPassed]}>
                        <Text style={[styles.statusText, { color: '#00D2B4' }]}>Quality Passed ✓</Text>
                      </View>
                    ) : patient.qualityStatus === 'failed' ? (
                      <View style={[styles.statusBadge, styles.statusFailed]}>
                        <Text style={[styles.statusText, { color: '#F43F5E' }]}>
                          Quality Failed ({patient.qualityReason || 'Sub-threshold'})
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, styles.statusPending]}>
                        <Text style={[styles.statusText, { color: '#94A3B8' }]}>Pending Evaluation</Text>
                      </View>
                    )}

                    {patient.imageUri ? (
                      <Text style={styles.imageSaved}>📸 Image Saved</Text>
                    ) : null}
                  </View>

                  {/* If still pending evaluation, show direct Run Analysis button */}
                  {!hasEvaluation && (
                    <TouchableOpacity
                      style={styles.analyzeNowBtn}
                      onPress={() => handleAnalyzeNow(patient)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.analyzeNowText}>⚡ Run AI Screening Now</Text>
                      <Text style={styles.analyzeNowArrow}>→</Text>
                    </TouchableOpacity>
                  )}

                  {hasEvaluation && (
                    <Text style={styles.tapToView}>Tap card to view full clinical telemetry & Grad-CAM →</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <Text style={styles.footer}>
          🔒 Telemetry records stored locally on flash storage with AES integrity.
        </Text>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#080C0E',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  section: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00D2B4',
    letterSpacing: 1.1,
    marginTop: 2,
  },
  backButton: {
    backgroundColor: '#16282E',
    borderWidth: 1,
    borderColor: '#00D2B4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  backText: {
    color: '#00D2B4',
    fontSize: 11,
    fontWeight: '800',
  },
  heading: {
    marginTop: 20,
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#94A3B8',
    marginTop: 4,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 14,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#11171D',
    borderWidth: 1,
    borderColor: '#1E2B37',
    borderRadius: 20,
    padding: 26,
    alignItems: 'center',
    marginTop: 14,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#16282E',
    borderWidth: 1,
    borderColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIconText: { fontSize: 26 },
  emptyTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, maxWidth: 300 },
  primaryButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#00D2B4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    marginTop: 18,
  },
  primaryButtonText: { color: '#080C0E', fontSize: 14, fontWeight: '800' },
  arrow: { color: '#080C0E', fontSize: 18, marginLeft: 8, fontWeight: '800' },
  listContent: { paddingBottom: 24 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  countText: { color: '#00D2B4', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  offlineText: { color: '#64748B', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  patientCard: {
    backgroundColor: '#11171D',
    borderWidth: 1.5,
    borderColor: '#1E2B37',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  patientTop: { flexDirection: 'row', alignItems: 'center' },
  patientIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  patientIconText: { color: '#080C0E', fontSize: 18, fontWeight: '900' },
  patientInfo: { flex: 1 },
  patientName: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  patientId: { color: '#94A3B8', fontSize: 10, marginTop: 2 },
  thumbnail: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#16282E', borderWidth: 1, borderColor: '#243442' },
  divider: { height: 1, backgroundColor: '#1E2B37', marginVertical: 12 },
  riskBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  riskBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  riskBannerIcon: { fontSize: 20, marginRight: 10 },
  riskBannerLabel: { fontSize: 14, fontWeight: '800' },
  riskBannerConfidence: { fontSize: 10, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
  riskBannerArrow: { fontSize: 18, fontWeight: '800', marginLeft: 8 },
  detailsRow: { flexDirection: 'row', marginBottom: 10 },
  detail: { flex: 1 },
  detailLabel: { color: '#64748B', fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  detailValue: { color: '#E2E8F0', fontSize: 11, fontWeight: '600', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  statusPassed: { backgroundColor: '#0A1C18', borderWidth: 1, borderColor: '#00D2B4' },
  statusFailed: { backgroundColor: '#210B10', borderWidth: 1, borderColor: '#F43F5E' },
  statusPending: { backgroundColor: '#161F28', borderWidth: 1, borderColor: '#334155' },
  statusText: { fontSize: 10, fontWeight: '800' },
  imageSaved: { color: '#38BDF8', fontSize: 10, fontWeight: '700' },
  analyzeNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D2B4',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  analyzeNowText: { color: '#080C0E', fontSize: 12, fontWeight: '800' },
  analyzeNowArrow: { color: '#080C0E', fontSize: 14, fontWeight: '800', marginLeft: 6 },
  tapToView: { color: '#00D2B4', fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  footer: { color: '#64748B', fontSize: 9, lineHeight: 14, textAlign: 'center', paddingHorizontal: 16, paddingVertical: 12 },
});
