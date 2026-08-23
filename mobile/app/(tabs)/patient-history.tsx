import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
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

  const getStatusText = (status?: PatientRecord['qualityStatus']) => {
    if (status === 'passed') {
      return 'Quality Passed ✓';
    }
    if (status === 'failed') {
      return 'Quality Failed ✗';
    }
    return 'Pending Evaluation';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>OralCare AI</Text>
            <Text style={styles.section}>OFFLINE ARCHIVE</Text>
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
            Cached local telemetry records for offline clinic operations.
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

            {patients.map((patient) => (
              <View key={patient.id} style={styles.patientCard}>

                {/* Top row */}
                <View style={styles.patientTop}>
                  <View style={styles.patientIcon}>
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
                </View>

                <View style={styles.divider} />

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
                </View>

                <View style={styles.createdRow}>
                  <Text style={styles.detailLabel}>RECORD TIMESTAMP</Text>
                  <Text style={styles.createdValue}>{formatDate(patient.createdAt)}</Text>
                </View>

                {/* Status Badge */}
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      patient.qualityStatus === 'passed' && styles.statusPassed,
                      patient.qualityStatus === 'failed' && styles.statusFailed,
                      patient.qualityStatus !== 'passed' && patient.qualityStatus !== 'failed' && styles.statusPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        patient.qualityStatus === 'passed' && { color: '#00D2B4' },
                        patient.qualityStatus === 'failed' && { color: '#F43F5E' },
                        patient.qualityStatus !== 'passed' && patient.qualityStatus !== 'failed' && { color: '#94A3B8' },
                      ]}
                    >
                      {getStatusText(patient.qualityStatus)}
                    </Text>
                  </View>

                  {patient.imageUri ? (
                    <Text style={styles.imageSaved}>📸 Image Cached</Text>
                  ) : null}
                </View>

                {patient.qualityReason ? (
                  <Text style={styles.reason}>Note: {patient.qualityReason}</Text>
                ) : null}

              </View>
            ))}
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
    paddingHorizontal: 22,
    paddingTop: 24,
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
    marginTop: 24,
    marginBottom: 16,
  },

  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },

  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#94A3B8',
    marginTop: 6,
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

  emptyIconText: {
    fontSize: 26,
  },

  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },

  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
  },

  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#00D2B4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    marginTop: 20,
  },

  primaryButtonText: {
    color: '#080C0E',
    fontSize: 14,
    fontWeight: '800',
  },

  arrow: {
    color: '#080C0E',
    fontSize: 18,
    marginLeft: 8,
    fontWeight: '800',
  },

  listContent: {
    paddingBottom: 24,
  },

  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  countText: {
    color: '#00D2B4',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  offlineText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  patientCard: {
    backgroundColor: '#11171D',
    borderWidth: 1,
    borderColor: '#1E2B37',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  patientTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  patientIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  patientIconText: {
    color: '#080C0E',
    fontSize: 18,
    fontWeight: '900',
  },

  patientInfo: {
    flex: 1,
  },

  patientName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },

  patientId: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: '#1E2B37',
    marginVertical: 12,
  },

  detailsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },

  detail: {
    flex: 1,
  },

  detailLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
  },

  detailValue: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  createdRow: {
    marginBottom: 10,
  },

  createdValue: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },

  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  statusPassed: {
    backgroundColor: '#0A1C18',
    borderWidth: 1,
    borderColor: '#00D2B4',
  },

  statusFailed: {
    backgroundColor: '#210B10',
    borderWidth: 1,
    borderColor: '#F43F5E',
  },

  statusPending: {
    backgroundColor: '#161F28',
    borderWidth: 1,
    borderColor: '#334155',
  },

  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },

  imageSaved: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },

  reason: {
    color: '#F43F5E',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    fontWeight: '500',
  },

  footer: {
    color: '#64748B',
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
