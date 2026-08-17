import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { updatePatientRecord } from '../storage/patientStorage';

type QualityResult = {
  passed: boolean;
  reason: string;
};

export default function QualityCheckScreen() {
  const router = useRouter();

  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<QualityResult | null>(null);

  const params = useLocalSearchParams<{
    patientId?: string;
    patientName?: string;
    age?: string;
    phone?: string;
    imageUri?: string;
  }>();

  /*
   * Expo Router parameters can technically be returned as
   * string | string[]. We explicitly convert them to strings
   * so TypeScript knows these values are safe to use.
   */
  const imageUri =
    typeof params.imageUri === 'string'
      ? params.imageUri
      : '';

  const patientId =
    typeof params.patientId === 'string'
      ? params.patientId
      : '';

  const patientName =
    typeof params.patientName === 'string'
      ? params.patientName
      : 'Patient';

  /*
   * MEMBER B INTEGRATION POINT
   *
   * Replace this temporary function later with Member B's
   * actual image-quality model/service.
   *
   * Expected output:
   * {
   *   passed: true/false,
   *   reason: "..."
   * }
   */
  const runQualityCheck = async (): Promise<QualityResult> => {
    // Temporary Phase-1 placeholder.
    // This allows the complete Member-A flow to work
    // before Member B's actual quality model is connected.

    await new Promise((resolve) =>
      setTimeout(resolve, 1000)
    );

    return {
      passed: true,
      reason:
        'Image quality is acceptable for the next stage.',
    };
  };

  const checkImage = async () => {
    if (!imageUri) {
      Alert.alert(
        'Image missing',
        'No captured image was provided.'
      );
      return;
    }

    try {
      setChecking(true);
      setResult(null);

      const qualityResult = await runQualityCheck();

      setResult(qualityResult);

      if (patientId) {
        await updatePatientRecord(patientId, {
          imageUri: imageUri,
          qualityStatus: qualityResult.passed
            ? 'passed'
            : 'failed',
          qualityReason: qualityResult.reason,
        });
      }
    } catch (error) {
      console.error('Quality check error:', error);

      Alert.alert(
        'Quality check failed',
        'The image could not be checked. Please try again.'
      );
    } finally {
      setChecking(false);
    }
  };

  const retake = () => {
    router.back();
  };

  const continueAfterQuality = () => {
    if (!result?.passed) {
      return;
    }

    /*
     * NEXT INTEGRATION POINT
     *
     * Member C risk classification
     *        ↓
     * risk category + confidence
     */

    Alert.alert(
      'Quality check passed',
      'The image has passed the basic quality check. It is ready for the next stage.',
      [
        {
          text: 'Done',
          onPress: () => router.back(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>OralCare</Text>
            <Text style={styles.section}>
              IMAGE QUALITY CHECK
            </Text>
          </View>

          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>4 / 4</Text>
          </View>
        </View>

        {/* Patient */}
        <View style={styles.patientCard}>
          <View style={styles.patientIcon}>
            <Text style={styles.patientIconText}>P</Text>
          </View>

          <View style={styles.patientInfo}>
            <Text style={styles.patientLabel}>
              CURRENT PATIENT
            </Text>

            <Text style={styles.patientName}>
              {patientName}
            </Text>

            <Text style={styles.patientId}>
              ID: {patientId || 'Not assigned'}
            </Text>
          </View>
        </View>

        {/* Heading */}
        <View style={styles.heading}>
          <Text style={styles.title}>
            Check image quality
          </Text>

          <Text style={styles.subtitle}>
            The image must pass the basic quality checks before
            it can continue to the risk-classification stage.
          </Text>
        </View>

        {/* Image */}
        <View style={styles.imageCard}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImage}>
              <Text style={styles.noImageIcon}>!</Text>

              <Text style={styles.noImageText}>
                No image available
              </Text>
            </View>
          )}
        </View>

        {/* Checks */}
        <View style={styles.checkCard}>
          <Text style={styles.checkTitle}>
            Quality checks
          </Text>

          <QualityRow
            label="Blur"
            description="Image should be reasonably sharp."
          />

          <QualityRow
            label="Lighting"
            description="The examination area should be adequately illuminated."
          />

          <QualityRow
            label="Glare"
            description="Strong reflections should not obscure the tissue."
          />

          <QualityRow
            label="Framing"
            description="The buccal cavity should be properly positioned."
            last
          />
        </View>

        {/* Run check */}
        {!result && (
          <Pressable
            onPress={checkImage}
            disabled={checking}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
              checking && styles.disabledButton,
            ]}
          >
            {checking ? (
              <>
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />

                <Text style={styles.primaryButtonText}>
                  Checking image...
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  Run quality check
                </Text>

                <Text style={styles.arrow}>→</Text>
              </>
            )}
          </Pressable>
        )}

        {/* Result */}
        {result && (
          <View
            style={[
              styles.resultCard,
              result.passed
                ? styles.resultPassed
                : styles.resultFailed,
            ]}
          >
            <View
              style={[
                styles.resultIcon,
                result.passed
                  ? styles.resultIconPassed
                  : styles.resultIconFailed,
              ]}
            >
              <Text style={styles.resultIconText}>
                {result.passed ? '✓' : '!'}
              </Text>
            </View>

            <View style={styles.resultContent}>
              <Text style={styles.resultTitle}>
                {result.passed
                  ? 'Quality check passed'
                  : 'Quality check failed'}
              </Text>

              <Text style={styles.resultReason}>
                {result.reason}
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        {result && (
          <View style={styles.actionArea}>
            {!result.passed && (
              <Pressable
                onPress={retake}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  Retake image
                </Text>
              </Pressable>
            )}

            {result.passed && (
              <Pressable
                onPress={continueAfterQuality}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  Continue
                </Text>

                <Text style={styles.arrow}>→</Text>
              </Pressable>
            )}

            <Text style={styles.footer}>
              {result.passed
                ? 'This image can now proceed to the next processing stage.'
                : 'Please capture another image with better positioning or lighting.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function QualityRow({
  label,
  description,
  last = false,
}: {
  label: string;
  description: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.qualityRow,
        last && styles.lastQualityRow,
      ]}
    >
      <View style={styles.pendingCircle}>
        <Text style={styles.pendingText}>•</Text>
      </View>

      <View style={styles.qualityContent}>
        <Text style={styles.qualityLabel}>
          {label}
        </Text>

        <Text style={styles.qualityDescription}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F9F8',
  },

  container: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  brand: {
    color: '#176B6B',
    fontSize: 15,
    fontWeight: '700',
  },

  section: {
    color: '#87969A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 3,
  },

  stepBadge: {
    backgroundColor: '#E8F3F0',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  stepText: {
    color: '#176B6B',
    fontSize: 12,
    fontWeight: '700',
  },

  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E9E7',
    borderRadius: 15,
    padding: 14,
    marginTop: 23,
  },

  patientIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#E2F0ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  patientIconText: {
    color: '#176B6B',
    fontSize: 18,
    fontWeight: '800',
  },

  patientInfo: {
    flex: 1,
  },

  patientLabel: {
    color: '#87969A',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  patientName: {
    color: '#19323C',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },

  patientId: {
    color: '#72838A',
    fontSize: 11,
    marginTop: 2,
  },

  heading: {
    marginTop: 25,
    marginBottom: 18,
  },

  title: {
    color: '#19323C',
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '700',
  },

  subtitle: {
    color: '#657980',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },

  imageCard: {
    width: '100%',
    height: 235,
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: '#DCE7E5',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  noImage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noImageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#176B6B',
    fontSize: 22,
    fontWeight: '800',
    overflow: 'hidden',
  },

  noImageText: {
    color: '#718187',
    fontSize: 12,
    marginTop: 8,
  },

  checkCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E9E7',
    borderRadius: 17,
    padding: 18,
    marginTop: 15,
  },

  checkTitle: {
    color: '#19323C',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 17,
  },

  qualityRow: {
    flexDirection: 'row',
    marginBottom: 17,
  },

  lastQualityRow: {
    marginBottom: 0,
  },

  pendingCircle: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#E9F2F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  pendingText: {
    color: '#176B6B',
    fontSize: 17,
    lineHeight: 17,
  },

  qualityContent: {
    flex: 1,
  },

  qualityLabel: {
    color: '#304A52',
    fontSize: 13,
    fontWeight: '700',
  },

  qualityDescription: {
    color: '#75868B',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 2,
  },

  primaryButton: {
    minHeight: 53,
    borderRadius: 12,
    backgroundColor: '#176B6B',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 19,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 20,
    marginLeft: 9,
  },

  secondaryButton: {
    height: 53,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#176B6B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 19,
  },

  secondaryButtonText: {
    color: '#176B6B',
    fontSize: 14,
    fontWeight: '700',
  },

  disabledButton: {
    opacity: 0.7,
  },

  buttonPressed: {
    opacity: 0.72,
  },

  resultCard: {
    flexDirection: 'row',
    borderRadius: 15,
    padding: 15,
    marginTop: 18,
    borderWidth: 1,
  },

  resultPassed: {
    backgroundColor: '#EEF7F4',
    borderColor: '#CBE5DD',
  },

  resultFailed: {
    backgroundColor: '#FFF5F2',
    borderColor: '#F0D4CC',
  },

  resultIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  resultIconPassed: {
    backgroundColor: '#D7ECE5',
  },

  resultIconFailed: {
    backgroundColor: '#F6DDD6',
  },

  resultIconText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#176B6B',
  },

  resultContent: {
    flex: 1,
  },

  resultTitle: {
    color: '#304A52',
    fontSize: 13,
    fontWeight: '700',
  },

  resultReason: {
    color: '#718187',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },

  actionArea: {
    marginTop: 0,
  },

  footer: {
    color: '#87969A',
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 15,
  },
});