
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

  const patientName = params.patientName || 'Patient';
  const patientId = params.patientId || 'Not assigned';

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
            <Text style={styles.brand}>OralCare</Text>
            <Text style={styles.section}>ORAL EXAMINATION</Text>
          </View>

          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>2 / 4</Text>
          </View>
        </View>

        {/* Patient */}
        <View style={styles.patientCard}>
          <View style={styles.patientIcon}>
            <Text style={styles.patientIconText}>P</Text>
          </View>

          <View style={styles.patientInfo}>
            <Text style={styles.patientLabel}>CURRENT PATIENT</Text>
            <Text style={styles.patientName}>{patientName}</Text>
            <Text style={styles.patientId}>ID: {patientId}</Text>
          </View>
        </View>

        {/* Main heading */}
        <View style={styles.heading}>
          <Text style={styles.title}>Ready for the examination?</Text>

          <Text style={styles.subtitle}>
            We will guide you through capturing a clear image of the inside
            of the mouth.
          </Text>
        </View>

        {/* Instructions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Before you start</Text>

          <Instruction
            number="1"
            title="Find good lighting"
            description="Use a bright, evenly lit area and avoid strong reflections."
          />

          <Instruction
            number="2"
            title="Position the patient"
            description="Ask the patient to sit comfortably and keep their head still."
          />

          <Instruction
            number="3"
            title="Follow the camera guide"
            description="The on-screen guide will help you frame the buccal cavity."
          />

          <Instruction
            number="4"
            title="Retake if needed"
            description="If the image is unclear, you can retake it before continuing."
            last
          />
        </View>

        {/* Capture area */}
        <View style={styles.capturePreview}>
          <View style={styles.previewCircle}>
            <Text style={styles.previewIcon}>⌁</Text>
          </View>

          <Text style={styles.previewTitle}>Guided image capture</Text>

          <Text style={styles.previewText}>
            Keep the inside of the cheek centred in the camera guide.
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
          <Text style={styles.startButtonText}>Start camera</Text>
          <Text style={styles.arrow}>→</Text>
        </Pressable>

        <Text style={styles.footer}>
          Your patient information is stored locally while working offline.
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
    backgroundColor: '#F5F9F8',
  },

  container: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 38,
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
  },

  section: {
    fontSize: 10,
    fontWeight: '700',
    color: '#87969A',
    letterSpacing: 0.8,
    marginTop: 3,
  },

  stepBadge: {
    backgroundColor: '#E8F3F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 15,
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
    marginTop: 25,
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
    marginTop: 27,
    marginBottom: 20,
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
    marginTop: 8,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E9E7',
    borderRadius: 17,
    padding: 18,
  },

  cardTitle: {
    color: '#19323C',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 18,
  },

  instruction: {
    flexDirection: 'row',
    marginBottom: 18,
  },

  lastInstruction: {
    marginBottom: 0,
  },

  numberCircle: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: '#E4F1EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  numberText: {
    color: '#176B6B',
    fontSize: 12,
    fontWeight: '800',
  },

  instructionContent: {
    flex: 1,
  },

  instructionTitle: {
    color: '#304A52',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },

  instructionText: {
    color: '#75868B',
    fontSize: 11,
    lineHeight: 17,
  },

  capturePreview: {
    backgroundColor: '#EAF4F1',
    borderRadius: 17,
    padding: 22,
    alignItems: 'center',
    marginTop: 15,
  },

  previewCircle: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: '#D7EAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  previewIcon: {
    color: '#176B6B',
    fontSize: 27,
  },

  previewTitle: {
    color: '#31565B',
    fontSize: 14,
    fontWeight: '700',
  },

  previewText: {
    color: '#718187',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 290,
  },

  startButton: {
    height: 53,
    borderRadius: 12,
    backgroundColor: '#176B6B',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 20,
  },

  buttonPressed: {
    opacity: 0.75,
  },

  startButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 20,
    marginLeft: 9,
  },

  footer: {
    color: '#87969A',
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 20,
  },
});