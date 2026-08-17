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

  const getStatusText = (
    status?: PatientRecord['qualityStatus']
  ) => {
    if (status === 'passed') {
      return 'Quality passed';
    }

    if (status === 'failed') {
      return 'Quality failed';
    }

    return 'Pending quality check';
  };

  const getStatusStyle = (
    status?: PatientRecord['qualityStatus']
  ) => {
    if (status === 'passed') {
      return styles.statusPassed;
    }

    if (status === 'failed') {
      return styles.statusFailed;
    }

    return styles.statusPending;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>OralCare</Text>
            <Text style={styles.section}>
              PATIENT HISTORY
            </Text>
          </View>

          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        {/* Heading */}
        <View style={styles.heading}>
          <Text style={styles.title}>
            Patient history
          </Text>

          <Text style={styles.subtitle}>
            Records stored locally on this device for offline use.
          </Text>
        </View>

        {/* Loading */}
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator
              size="large"
              color="#176B6B"
            />

            <Text style={styles.stateText}>
              Loading patient history...
            </Text>
          </View>
        ) : patients.length === 0 ? (

          /* Empty state */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>+</Text>
            </View>

            <Text style={styles.emptyTitle}>
              No patient records yet
            </Text>

            <Text style={styles.emptyText}>
              Registered patients will appear here after you
              start an examination.
            </Text>

            <Pressable
              onPress={() => router.push('/registration')}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>
                Register patient
              </Text>

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
                tintColor="#176B6B"
              />
            }
          >
            <View style={styles.countRow}>
              <Text style={styles.countText}>
                {patients.length}{' '}
                {patients.length === 1
                  ? 'patient'
                  : 'patients'}
              </Text>

              <Text style={styles.offlineText}>
                Offline records
              </Text>
            </View>

            {patients.map((patient) => (
              <View
                key={patient.id}
                style={styles.patientCard}
              >

                {/* Patient heading */}
                <View style={styles.patientTop}>
                  <View style={styles.patientIcon}>
                    <Text style={styles.patientIconText}>
                      {patient.patientName
                        ? patient.patientName
                            .charAt(0)
                            .toUpperCase()
                        : 'P'}
                    </Text>
                  </View>

                  <View style={styles.patientInfo}>
                    <Text style={styles.patientName}>
                      {patient.patientName}
                    </Text>

                    <Text style={styles.patientId}>
                      ID: {patient.id}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Patient details */}
                <View style={styles.detailsRow}>
                  <View style={styles.detail}>
                    <Text style={styles.detailLabel}>
                      AGE
                    </Text>

                    <Text style={styles.detailValue}>
                      {patient.age}
                    </Text>
                  </View>

                  <View style={styles.detail}>
                    <Text style={styles.detailLabel}>
                      PHONE
                    </Text>

                    <Text style={styles.detailValue}>
                      {patient.phone || 'Not provided'}
                    </Text>
                  </View>
                </View>

                <View style={styles.createdRow}>
                  <Text style={styles.detailLabel}>
                    CREATED
                  </Text>

                  <Text style={styles.createdValue}>
                    {formatDate(patient.createdAt)}
                  </Text>
                </View>

                {/* Quality status */}
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      getStatusStyle(
                        patient.qualityStatus
                      ),
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {getStatusText(
                        patient.qualityStatus
                      )}
                    </Text>
                  </View>

                  {patient.imageUri ? (
                    <Text style={styles.imageSaved}>
                      Image saved
                    </Text>
                  ) : null}
                </View>

                {/* Quality reason */}
                {patient.qualityReason ? (
                  <Text style={styles.reason}>
                    {patient.qualityReason}
                  </Text>
                ) : null}

              </View>
            ))}
          </ScrollView>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Patient records remain on this device for offline use.
        </Text>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F9F8',
  },

  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  brand: {
    fontSize: 15,
    fontWeight: '700',
    color: '#176B6B',
    letterSpacing: 0.3,
  },

  section: {
    fontSize: 10,
    fontWeight: '700',
    color: '#87969A',
    letterSpacing: 0.8,
    marginTop: 3,
  },

  backButton: {
    backgroundColor: '#E8F3F0',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
  },

  backText: {
    color: '#176B6B',
    fontSize: 12,
    fontWeight: '700',
  },

  heading: {
    marginTop: 27,
    marginBottom: 18,
  },

  title: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '700',
    color: '#19323C',
  },

  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#60737A',
    marginTop: 7,
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stateText: {
    color: '#718187',
    fontSize: 12,
    marginTop: 12,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1EAE8',
    borderRadius: 17,
    padding: 24,
    alignItems: 'center',
    marginTop: 10,
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E4F1EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  emptyIconText: {
    color: '#176B6B',
    fontSize: 28,
  },

  emptyTitle: {
    color: '#19323C',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },

  emptyText: {
    color: '#718187',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
    maxWidth: 300,
  },

  primaryButton: {
    minHeight: 51,
    borderRadius: 12,
    backgroundColor: '#176B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 18,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 19,
    marginLeft: 8,
  },

  listContent: {
    paddingBottom: 20,
  },

  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  countText: {
    color: '#31565B',
    fontSize: 12,
    fontWeight: '700',
  },

  offlineText: {
    color: '#87969A',
    fontSize: 10,
  },

  patientCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1EAE8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },

  patientTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  patientIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#E4F1EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  patientIconText: {
    color: '#176B6B',
    fontSize: 16,
    fontWeight: '800',
  },

  patientInfo: {
    flex: 1,
  },

  patientName: {
    color: '#19323C',
    fontSize: 15,
    fontWeight: '700',
  },

  patientId: {
    color: '#87969A',
    fontSize: 10,
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: '#EDF2F1',
    marginVertical: 13,
  },

  detailsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },

  detail: {
    flex: 1,
  },

  detailLabel: {
    color: '#87969A',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.7,
  },

  detailValue: {
    color: '#40565E',
    fontSize: 11,
    marginTop: 3,
  },

  createdRow: {
    marginBottom: 2,
  },

  createdValue: {
    color: '#40565E',
    fontSize: 11,
    marginTop: 3,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 13,
  },

  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  statusPassed: {
    backgroundColor: '#E1F2EA',
  },

  statusFailed: {
    backgroundColor: '#F9E4E0',
  },

  statusPending: {
    backgroundColor: '#EEF1F0',
  },

  statusText: {
    color: '#40565E',
    fontSize: 9,
    fontWeight: '700',
  },

  imageSaved: {
    color: '#176B6B',
    fontSize: 9,
    fontWeight: '700',
  },

  reason: {
    color: '#718187',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 9,
  },

  footer: {
    color: '#87969A',
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
});
