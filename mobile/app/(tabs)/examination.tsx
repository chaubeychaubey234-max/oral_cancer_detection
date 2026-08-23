import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { getActiveBaseUrl, getOrFetchToken } from '@/hooks/use-auth';

const CLINICAL_SAMPLES = [
  { id: '01_good_mucosa.jpg', title: 'Good Mucosa', tag: 'Standard Oral Cavity', icon: '🩺', color: '#00D2B4' },
  { id: '02_blurry_mucosa.jpg', title: 'Blurry Frame', tag: 'Laplacian Test', icon: '🌫️', color: '#F43F5E' },
  { id: '05_glare_mucosa.jpg', title: 'Flash Glare', tag: 'Specular Glare Test', icon: '⚡', color: '#F59E0B' },
  { id: '03_underexposed_mucosa.jpg', title: 'Underexposed', tag: 'Low Light Test', icon: '🌑', color: '#64748B' },
  { id: '12_realistic_camera_photo.jpg', title: 'Clinical Macro', tag: 'Phone Camera', icon: '🔬', color: '#38BDF8' },
];

export default function ExaminationScreen() {
  const router = useRouter();
  const [loadingSample, setLoadingSample] = useState<string | null>(null);

  const params = useLocalSearchParams<{
    patientId?: string;
    patientName?: string;
    age?: string;
    phone?: string;
  }>();

  const patientName = params.patientName || 'Clinical Subject';
  const patientId = params.patientId || `local-${Date.now()}`;

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

  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        if (selectedUri) {
          router.push({
            pathname: '/quality-check',
            params: {
              patientId,
              patientName,
              age: params.age || '',
              phone: params.phone || '',
              imageUri: selectedUri,
            },
          });
        }
      }
    } catch (err: any) {
      console.error('Gallery picker error:', err);
      Alert.alert('Upload Error', 'Could not access device gallery. Please try again.');
    }
  };

  const handleSelectSample = async (sampleId: string) => {
    try {
      setLoadingSample(sampleId);
      await getOrFetchToken();
      const baseUrl = getActiveBaseUrl();
      const sampleUrl = `${baseUrl}/sample-images/${sampleId}`;
      const localTarget = `${FileSystem.cacheDirectory}${sampleId}`;

      const downloadRes = await FileSystem.downloadAsync(sampleUrl, localTarget);

      if (downloadRes.status === 200 && downloadRes.uri) {
        router.push({
          pathname: '/quality-check',
          params: {
            patientId,
            patientName,
            age: params.age || '',
            phone: params.phone || '',
            imageUri: downloadRes.uri,
          },
        });
      } else {
        throw new Error(`Download failed with status ${downloadRes.status}`);
      }
    } catch (err: any) {
      console.error('Sample loading error:', err);
      Alert.alert('Sample Loading Error', 'Unable to fetch clinical sample from server.');
    } finally {
      setLoadingSample(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.patientIconText}>{patientName.charAt(0).toUpperCase()}</Text>
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
            Capture live optical scan or upload existing oral cavity image for AI screening.
          </Text>
        </View>

        {/* Two Main Ingestion Action Buttons */}
        <View style={styles.actionsContainer}>
          <Pressable
            onPress={handleStartCapture}
            style={({ pressed }) => [
              styles.primaryActionBtn,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.btnIconCircle}>
              <Text style={styles.btnIcon}>📷</Text>
            </View>
            <View style={styles.btnTextContainer}>
              <Text style={styles.btnMainTitle}>Launch Guided Camera</Text>
              <Text style={styles.btnSubtitle}>Live viewfinder with buccal alignment HUD</Text>
            </View>
            <Text style={styles.btnArrow}>→</Text>
          </Pressable>

          <Pressable
            onPress={handlePickFromGallery}
            style={({ pressed }) => [
              styles.secondaryActionBtn,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={[styles.btnIconCircle, styles.galleryIconCircle]}>
              <Text style={styles.btnIcon}>📁</Text>
            </View>
            <View style={styles.btnTextContainer}>
              <Text style={styles.btnSecondaryTitle}>Upload from Gallery / Files</Text>
              <Text style={styles.btnSubtitle}>Select oral scan or medical photo from device</Text>
            </View>
            <Text style={styles.btnSecondaryArrow}>→</Text>
          </Pressable>
        </View>

        {/* Quick Clinical Test Samples */}
        <View style={styles.samplesSection}>
          <View style={styles.samplesHeader}>
            <Text style={styles.samplesTitle}>Clinical Reference Samples</Text>
            <Text style={styles.samplesBadge}>1-TAP TEST</Text>
          </View>
          <Text style={styles.samplesSubtitle}>
            Instant verification against benchmark oral lesions & OpenCV quality edge-cases:
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.samplesScroll}>
            {CLINICAL_SAMPLES.map((sample) => (
              <TouchableOpacity
                key={sample.id}
                style={[styles.sampleCard, { borderColor: sample.color }]}
                onPress={() => handleSelectSample(sample.id)}
                disabled={loadingSample !== null}
                activeOpacity={0.8}
              >
                {loadingSample === sample.id ? (
                  <ActivityIndicator color={sample.color} size="small" style={{ marginVertical: 12 }} />
                ) : (
                  <>
                    <Text style={styles.sampleIcon}>{sample.icon}</Text>
                    <Text style={styles.sampleCardTitle}>{sample.title}</Text>
                    <View style={[styles.sampleTagBadge, { backgroundColor: `${sample.color}20` }]}>
                      <Text style={[styles.sampleTagText, { color: sample.color }]}>{sample.tag}</Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Instructions Checklist Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Clinical Acquisition Checklist</Text>

          <Instruction
            number="1"
            title="Direct Mucosal Illumination"
            description="Use direct bright ambient light or phone torch to avoid dark mucosa underexposure."
          />
          <Instruction
            number="2"
            title="Cheek Retraction & Stability"
            description="Ask the patient to keep still and gently open the mouth for full buccal cavity visibility."
          />
          <Instruction
            number="3"
            title="OpenCV Quality Matrix"
            description="Checks blur variance (>100), lighting balance, and specular glare (<5%) before inference."
          />
          <Instruction
            number="4"
            title="MobileNetV2 Risk Classification"
            description="Trained neural network evaluates tissue risk (Low / Moderate / High) with Grad-CAM heatmap."
            last
          />
        </View>

        <Text style={styles.footer}>
          🔒 End-to-end encrypted pipeline. Evaluates Member B OpenCV matrix & Member C neural risk model.
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
  safeArea: { flex: 1, backgroundColor: '#080C0E' },
  container: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 38 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 16, fontWeight: '800', color: '#F8FAFC', letterSpacing: 0.3 },
  section: { fontSize: 9, fontWeight: '700', color: '#00D2B4', letterSpacing: 1.1, marginTop: 2 },
  stepBadge: { backgroundColor: '#16282E', borderWidth: 1, borderColor: '#00D2B4', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  stepText: { color: '#00D2B4', fontSize: 11, fontWeight: '700' },
  patientCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#11171D',
    borderWidth: 1, borderColor: '#1E2B37', borderRadius: 16, padding: 14, marginTop: 18,
  },
  patientIcon: {
    width: 42, height: 42, borderRadius: 13, backgroundColor: '#00D2B4',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  patientIconText: { color: '#080C0E', fontSize: 17, fontWeight: '900' },
  patientInfo: { flex: 1 },
  patientLabel: { color: '#64748B', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  patientName: { color: '#F8FAFC', fontSize: 15, fontWeight: '800', marginTop: 2 },
  patientId: { color: '#64748B', fontSize: 11, fontWeight: '500', marginTop: 1 },
  heading: { marginTop: 18, marginBottom: 16 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, lineHeight: 19, color: '#94A3B8', marginTop: 6 },
  actionsContainer: { gap: 12, marginBottom: 20 },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D2B4',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#00D2B4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11171D',
    borderWidth: 1.5,
    borderColor: '#00D2B4',
    borderRadius: 18,
    padding: 16,
  },
  btnIconCircle: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: '#080C0E',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  galleryIconCircle: {
    backgroundColor: '#16282E',
  },
  btnIcon: { fontSize: 20 },
  btnTextContainer: { flex: 1 },
  btnMainTitle: { color: '#080C0E', fontSize: 15, fontWeight: '800' },
  btnSecondaryTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  btnSubtitle: { color: '#0F2623', fontSize: 11, fontWeight: '600', marginTop: 2 },
  btnArrow: { color: '#080C0E', fontSize: 20, fontWeight: '900', marginLeft: 8 },
  btnSecondaryArrow: { color: '#00D2B4', fontSize: 20, fontWeight: '900', marginLeft: 8 },
  samplesSection: {
    backgroundColor: '#11171D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2B37',
    padding: 18,
    marginBottom: 20,
  },
  samplesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  samplesTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  samplesBadge: { color: '#00D2B4', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  samplesSubtitle: { color: '#94A3B8', fontSize: 11, lineHeight: 16, marginBottom: 14 },
  samplesScroll: { gap: 10, paddingVertical: 2 },
  sampleCard: {
    backgroundColor: '#0B1015',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    width: 130,
  },
  sampleIcon: { fontSize: 24, marginBottom: 6 },
  sampleCardTitle: { color: '#F8FAFC', fontSize: 12, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  sampleTagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sampleTagText: { fontSize: 9, fontWeight: '700' },
  card: {
    backgroundColor: '#11171D',
    borderWidth: 1,
    borderColor: '#1E2B37',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#F1F5F9', marginBottom: 16 },
  instruction: { flexDirection: 'row', marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#161F28' },
  lastInstruction: { marginBottom: 0, paddingBottom: 0, borderBottomWidth: 0 },
  numberCircle: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#16282E',
    borderWidth: 1, borderColor: '#00D2B4', alignItems: 'center', justifyContent: 'center',
    marginRight: 12, marginTop: 2,
  },
  numberText: { color: '#00D2B4', fontSize: 11, fontWeight: '800' },
  instructionContent: { flex: 1 },
  instructionTitle: { color: '#E2E8F0', fontSize: 13, fontWeight: '700', marginBottom: 3 },
  instructionText: { color: '#94A3B8', fontSize: 11, lineHeight: 16 },
  buttonPressed: { opacity: 0.8 },
  footer: { textAlign: 'center', fontSize: 10, lineHeight: 15, color: '#64748B', paddingHorizontal: 12 },
});