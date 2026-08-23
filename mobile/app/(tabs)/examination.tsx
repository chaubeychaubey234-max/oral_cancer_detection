import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ExaminationScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    patientId?: string;
    patientName?: string;
    age?: string;
    phone?: string;
  }>();

  const patientName = params.patientName || 'Clinical Subject';
  const patientId = params.patientId || 'Unassigned Session';

  const handleStartCapture = () => {
    router.push({
      pathname: '/camera',
      params: {
        patientId,
        patientName,
        age: params.age || '',
        phone: params.phone || '',
      },
    });
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
            <Text style={styles.brand}>OralCare AI</Text>
            <Text style={styles.section}>ORAL EXAMINATION</Text>
          </View>

          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>Step 2 of 4</Text>
          </View>
        </View>

        {/* Patient Pill */}
        <View style={styles.patientCard}>
          <View style={styles.patientIcon}>
            <Text style={styles.patientIconText}>
              {patientName.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.patientInfo}>
            <Text style={styles.patientLabel}>ACTIVE PATIENT</Text>
            <Text style={styles.patientName}>{patientName}</Text>
            <Text style={styles.patientId}>ID: {patientId}</Text>
          </View>
        </View>

        {/* Main heading */}
        <View style={styles.heading}>
          <Text style={styles.title}>Oral Cavity Protocol</Text>
          <Text style={styles.subtitle}>
            Guided clinical optical scanning for the buccal mucosa & oral mucosa layers.
          </Text>
        </View>

        {/* Instructions Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Capture Checklist</Text>

          <Instruction
            number="1"
            title="Sufficient Clinical Illumination"
            description="Use direct bright ambient light or phone torch to avoid dark mucosa underexposure."
          />

          <Instruction
            number="2"
            title="Stabilize & Retract Cheek"
            description="Ask the patient to keep still and gently open the mouth for full buccal cavity visibility."
          />

          <Instruction
            number="3"
            title="Align Inside Optical HUD"
            description="Keep the target mucosal tissue centered within the white rectangular viewfinder."
          />

          <Instruction
            number="4"
            title="Automated Quality Filtering"
            description="The Member B OpenCV engine will check blur, lighting, and glare before ML inference."
            last
          />
        </View>

        {/* Capture preview card */}
        <View style={styles.capturePreview}>
          <View style={styles.previewCircle}>
            <Text style={styles.previewIcon}>📸</Text>
          </View>

          <Text style={styles.previewTitle}>Optical Telemetry Ready</Text>

          <Text style={styles.previewText}>
            Align target mucosal surface within the guided frame.
          </Text>
        </View>

        {/* Button */}
        <Pressable
          onPress={handleStartCapture}
          style={({ pressed }) => [
            styles.startButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.startButtonText}>Launch Guided Camera</Text>
          <Text style={styles.arrow}>→</Text>
        </Pressable>

        <Text style={styles.footer}>
          🔒 Quality verification runs on-device & encrypted backend prior to AI classification.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Instruction({
  number,
  title,
  description,
  last = false,
}: {
  number: string;
  title: string;
  description: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.instruction, last && styles.lastInstruction]}>
      <View style={styles.numberCircle}>
        <Text style={styles.numberText}>{number}</Text>
      </View>

      <View style={styles.instructionContent}>
        <Text style={styles.instructionTitle}>{title}</Text>
        <Text style={styles.instructionText}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#080C0E',
  },

  container: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 38,
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

  stepBadge: {
    backgroundColor: '#16282E',
    borderWidth: 1,
    borderColor: '#00D2B4',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },

  stepText: {
    color: '#00D2B4',
    fontSize: 11,
    fontWeight: '700',
  },

  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11171D',
    borderWidth: 1,
    borderColor: '#1E2B37',
    borderRadius: 16,
    padding: 14,
    marginTop: 22,
  },

  patientIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  patientIconText: {
    color: '#080C0E',
    fontSize: 18,
    fontWeight: '900',
  },

  patientInfo: {
    flex: 1,
  },

  patientLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  patientName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },

  patientId: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },

  heading: {
    marginTop: 24,
    marginBottom: 18,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

  card: {
    backgroundColor: '#11171D',
    borderWidth: 1,
    borderColor: '#1E2B37',
    borderRadius: 18,
    padding: 20,
  },

  cardTitle: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },

  instruction: {
    flexDirection: 'row',
    marginBottom: 16,
  },

  lastInstruction: {
    marginBottom: 0,
  },

  numberCircle: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#16282E',
    borderWidth: 1,
    borderColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },

  numberText: {
    color: '#00D2B4',
    fontSize: 12,
    fontWeight: '800',
  },

  instructionContent: {
    flex: 1,
  },

  instructionTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },

  instructionText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
  },

  capturePreview: {
    backgroundColor: '#0E171E',
    borderWidth: 1,
    borderColor: '#1A2936',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginTop: 16,
  },

  previewCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#16282E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  previewIcon: {
    fontSize: 24,
  },

  previewTitle: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
  },

  previewText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 290,
  },

  startButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 22,
    shadowColor: '#00D2B4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },

  buttonPressed: {
    opacity: 0.8,
  },

  startButtonText: {
    color: '#080C0E',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  arrow: {
    color: '#080C0E',
    fontSize: 18,
    marginLeft: 8,
    fontWeight: '800',
  },

  footer: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
});