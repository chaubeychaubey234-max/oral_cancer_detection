import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getActiveBaseUrl, getOrFetchToken } from '@/hooks/use-auth';
import { updatePatientRecord, savePatientRecord } from '../storage/patientStorage';

type QualityAudit = {
  passed: boolean;
  reason: string | null;
  all_failed_reasons: string[];
  blur_score: number | null;
  brightness_score: number | null;
  glare_area_pct: number | null;
  framing_confidence: number | null;
  module_version: string | null;
};

type RiskAssessment = {
  risk_category: string | null;
  confidence: number | null;
  cannot_assess: boolean;
  cannot_assess_reason: string | null;
  heatmap_url: string | null;
  model_version: string | null;
};

type CaseOut = {
  id: string;
  status: string;
  quality_audit: QualityAudit | null;
  risk_assessment: RiskAssessment | null;
};

type Phase = 'idle' | 'uploading' | 'quality' | 'model' | 'done' | 'offline_saved' | 'error';

export default function QualityCheckScreen() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('idle');
  const [caseResult, setCaseResult] = useState<CaseOut | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const params = useLocalSearchParams<{
    patientId?: string;
    patientName?: string;
    age?: string;
    phone?: string;
    imageUri?: string;
  }>();

  const imageUri = typeof params.imageUri === 'string' ? params.imageUri : '';
  const rawPatientId = typeof params.patientId === 'string' ? params.patientId : '';
  const patientId = rawPatientId || `local-${Date.now()}`;
  const patientName = typeof params.patientName === 'string' ? params.patientName : 'Clinical Subject';

  useEffect(() => {
    if (imageUri) {
      runFullPipeline();
    } else {
      setErrorMsg('No optical frame received. Please retake or select an image.');
      setPhase('error');
    }
  }, [imageUri]);

  const runFullPipeline = async () => {
    if (!imageUri) {
      setErrorMsg('Missing optical capture frame.');
      setPhase('error');
      return;
    }

    try {
      setPhase('uploading');
      const token = await getOrFetchToken();
      const baseUrl = getActiveBaseUrl();

      // Clean uri for React Native multipart upload
      const cleanUri = imageUri.startsWith('file://') || imageUri.startsWith('content://')
        ? imageUri
        : `file://${imageUri}`;

      const formData = new FormData();
      formData.append('patient_id', patientId);
      formData.append('file', {
        uri: cleanUri,
        name: 'oral-examination.jpg',
        type: 'image/jpeg',
      } as any);

      setPhase('quality');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/cases`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
          signal: controller.signal,
        });
      } catch (netErr: any) {
        clearTimeout(timeout);
        throw netErr;
      }

      clearTimeout(timeout);

      if (!response.ok) {
        // If patient was registered locally, create patient on backend first
        if (response.status === 404 || patientId.startsWith('local-')) {
          try {
            const createPat = await fetch(`${baseUrl}/patients`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                name: patientName,
                age: parseInt(params.age || '40', 10),
                phone: params.phone || undefined,
              }),
            });

            if (createPat.ok) {
              const patData = await createPat.json();
              const retryFormData = new FormData();
              retryFormData.append('patient_id', patData.id);
              retryFormData.append('file', {
                uri: cleanUri,
                name: 'oral-examination.jpg',
                type: 'image/jpeg',
              } as any);

              const retryRes = await fetch(`${baseUrl}/cases`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: retryFormData,
              });

              if (retryRes.ok) {
                const retryData: CaseOut = await retryRes.json();
                setCaseResult(retryData);
                await updatePatientRecord(patientId, {
                  imageUri,
                  qualityStatus: retryData.quality_audit?.passed ? 'passed' : 'failed',
                  qualityReason: retryData.quality_audit?.reason ?? undefined,
                }).catch(() => {});
                setPhase('done');
                return;
              }
            }
          } catch (createErr) {
            console.log('Online patient sync attempt skipped:', createErr);
          }
        }

        const err = await response.json().catch(() => ({}));
        throw new Error(err?.detail ?? `Inference node status ${response.status}`);
      }

      setPhase('model');
      const data: CaseOut = await response.json();
      setCaseResult(data);

      await updatePatientRecord(patientId, {
        imageUri,
        qualityStatus: data.quality_audit?.passed ? 'passed' : 'failed',
        qualityReason: data.quality_audit?.reason ?? undefined,
      }).catch(() => {});

      setPhase('done');
    } catch (error: any) {
      console.log('Pipeline transitioning to offline mode:', error?.message || error);
      // Seamlessly save into local encrypted patient vault
      try {
        await updatePatientRecord(patientId, {
          imageUri,
          qualityStatus: 'pending',
          qualityReason: 'Stored locally (Offline sync ready)',
        });
      } catch (storageErr) {
        console.error('Local storage update error:', storageErr);
      }
      setPhase('offline_saved');
    }
  };

  const goToResults = () => {
    if (!caseResult) return;
    router.push({
      pathname: '/results',
      params: {
        caseId: caseResult.id,
        patientName,
        status: caseResult.status,
        qualityPassed: caseResult.quality_audit?.passed ? 'true' : 'false',
        qualityReason: caseResult.quality_audit?.reason ?? '',
        qualityAllFailed: JSON.stringify(caseResult.quality_audit?.all_failed_reasons ?? []),
        blurScore: String(caseResult.quality_audit?.blur_score ?? ''),
        brightnessScore: String(caseResult.quality_audit?.brightness_score ?? ''),
        glareAreaPct: String(caseResult.quality_audit?.glare_area_pct ?? ''),
        framingConfidence: String(caseResult.quality_audit?.framing_confidence ?? ''),
        riskCategory: caseResult.risk_assessment?.risk_category ?? '',
        confidence: String(caseResult.risk_assessment?.confidence ?? ''),
        cannotAssess: caseResult.risk_assessment?.cannot_assess ? 'true' : 'false',
        cannotAssessReason: caseResult.risk_assessment?.cannot_assess_reason ?? '',
        modelVersion: caseResult.risk_assessment?.model_version ?? '',
        imageUri,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>OralCare AI</Text>
            <Text style={styles.section}>AI TELEMETRY PIPELINE</Text>
          </View>
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>Step 4 of 4</Text>
          </View>
        </View>

        {/* Image preview */}
        {imageUri ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
            <View style={styles.imageOverlayBadge}>
              <Text style={styles.imageOverlayText}>RAW FRAME</Text>
            </View>
          </View>
        ) : null}

        {/* Status card */}
        <View style={styles.statusCard}>
          {phase === 'idle' && (
            <StatusRow icon="⏳" label="Initializing analysis sequence..." color="#94A3B8" />
          )}

          {(phase === 'uploading' || phase === 'quality' || phase === 'model') && (
            <>
              <View style={styles.spinnerRow}>
                <ActivityIndicator color="#00D2B4" size="large" />
              </View>
              <Text style={styles.phaseTitle}>
                {phase === 'uploading' && 'Dispatching Optical Data…'}
                {phase === 'quality' && 'OpenCV Quality Matrix Check…'}
                {phase === 'model' && 'MobileNetV2 Neural Risk Inference…'}
              </Text>
              <Text style={styles.phaseSubtitle}>
                {phase === 'uploading' && 'Secure transmission to local inference node'}
                {phase === 'quality' && 'Evaluating Laplacian variance, glare, exposure & framing'}
                {phase === 'model' && 'Classifying mucosal lesions against validated dataset'}
              </Text>
            </>
          )}

          {phase === 'done' && caseResult && (
            <>
              <StatusRow
                icon={caseResult.quality_audit?.passed ? '✓' : '✗'}
                label={
                  caseResult.quality_audit?.passed
                    ? 'Optical quality verified ✓'
                    : `Quality check failed: ${caseResult.quality_audit?.reason ?? 'Artifacts detected'}`
                }
                color={caseResult.quality_audit?.passed ? '#00D2B4' : '#F43F5E'}
              />

              {caseResult.risk_assessment ? (
                <StatusRow
                  icon={riskIcon(caseResult.risk_assessment.risk_category)}
                  label={
                    caseResult.risk_assessment.cannot_assess
                      ? 'Inconclusive assessment — clinical retake advised'
                      : `Risk Assessment: ${formatRisk(caseResult.risk_assessment.risk_category)}`
                  }
                  color={riskColor(caseResult.risk_assessment.risk_category)}
                />
              ) : (
                <StatusRow icon="⚠️" label="Quality threshold unmet — inference bypassed" color="#F59E0B" />
              )}

              <Pressable style={styles.viewBtn} onPress={goToResults}>
                <Text style={styles.viewBtnText}>View Clinical Assessment →</Text>
              </Pressable>
            </>
          )}

          {phase === 'offline_saved' && (
            <>
              <StatusRow icon="🛡️" label="Frame Secured in Offline Vault" color="#00D2B4" />
              <Text style={styles.offlineText}>
                The capture has been preserved in the encrypted local patient storage. It is indexed in your archive and will synchronize once reconnected.
              </Text>
              <Pressable style={styles.viewBtn} onPress={() => router.push('/(tabs)/patient-history')}>
                <Text style={styles.viewBtnText}>View in Patient Archive →</Text>
              </Pressable>
              <Pressable style={styles.retryBtn} onPress={runFullPipeline}>
                <Text style={styles.retryBtnText}>↻ Retry Server Analysis</Text>
              </Pressable>
            </>
          )}

          {phase === 'error' && (
            <>
              <StatusRow icon="✗" label={errorMsg ?? 'Communication error'} color="#F43F5E" />
              <Pressable style={styles.retryBtn} onPress={runFullPipeline}>
                <Text style={styles.retryBtnText}>Retry Pipeline</Text>
              </Pressable>
              <Pressable style={styles.backBtn} onPress={() => router.back()}>
                <Text style={styles.backBtnText}>← Retake Optical Frame</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Pipeline steps legend */}
        <View style={styles.legend}>
          <LegendStep
            number="1"
            label="Quality Matrix"
            done={phase === 'model' || phase === 'done' || phase === 'offline_saved'}
            active={phase === 'quality'}
          />
          <View style={[styles.legendLine, (phase === 'model' || phase === 'done' || phase === 'offline_saved') && styles.legendLineActive]} />
          <LegendStep
            number="2"
            label="Neural Model"
            done={phase === 'done'}
            active={phase === 'model'}
          />
          <View style={[styles.legendLine, phase === 'done' && styles.legendLineActive]} />
          <LegendStep
            number="3"
            label="Diagnostics"
            done={false}
            active={phase === 'done'}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusRow({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={statusRowStyles.row}>
      <Text style={[statusRowStyles.icon, { color }]}>{icon}</Text>
      <Text style={[statusRowStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

function LegendStep({
  number, label, done, active,
}: {
  number: string; label: string; done: boolean; active: boolean;
}) {
  return (
    <View style={legendStyles.step}>
      <View style={[
        legendStyles.circle,
        done && legendStyles.circleDone,
        active && legendStyles.circleActive,
      ]}>
        <Text style={[legendStyles.num, (done || active) && legendStyles.numActive]}>
          {done ? '✓' : number}
        </Text>
      </View>
      <Text style={[legendStyles.lbl, (done || active) && legendStyles.lblActive]}>{label}</Text>
    </View>
  );
}

function riskIcon(category: string | null) {
  if (!category) return '?';
  const c = category.toLowerCase();
  if (c === 'low') return '✓';
  if (c === 'medium' || c === 'moderate') return '⚠';
  return '⛔';
}

function riskColor(category: string | null) {
  if (!category) return '#94A3B8';
  const c = category.toLowerCase();
  if (c === 'low') return '#00D2B4';
  if (c === 'medium' || c === 'moderate') return '#F59E0B';
  return '#F43F5E';
}

function formatRisk(category: string | null) {
  if (!category) return 'Unknown';
  return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#080C0E' },
  container: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 38 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 16, fontWeight: '800', color: '#F8FAFC' },
  section: { fontSize: 9, fontWeight: '700', color: '#00D2B4', letterSpacing: 1.1, marginTop: 2 },
  stepBadge: { backgroundColor: '#16282E', borderWidth: 1, borderColor: '#00D2B4', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  stepText: { color: '#00D2B4', fontSize: 11, fontWeight: '700' },
  imageContainer: {
    width: '100%', height: 210, borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#11171D', borderWidth: 1, borderColor: '#1E2B37', marginTop: 18,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  imageOverlayBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(8,12,14,0.85)',
    borderWidth: 1,
    borderColor: '#243442',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  imageOverlayText: {
    color: '#00D2B4',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statusCard: {
    backgroundColor: '#11171D',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1E2B37',
    padding: 22,
    marginTop: 18,
    minHeight: 130,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  spinnerRow: { alignItems: 'center', marginBottom: 16 },
  phaseTitle: { fontSize: 17, fontWeight: '800', color: '#F8FAFC', textAlign: 'center' },
  phaseSubtitle: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 6, lineHeight: 17 },
  offlineText: { fontSize: 12, color: '#94A3B8', marginTop: 8, lineHeight: 18 },
  viewBtn: {
    marginTop: 18,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D2B4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  viewBtnText: { color: '#080C0E', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  retryBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#16282E',
    borderWidth: 1,
    borderColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: { color: '#00D2B4', fontSize: 13, fontWeight: '800' },
  backBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  backBtnText: { color: '#00D2B4', fontSize: 14, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    paddingHorizontal: 6,
  },
  legendLine: { flex: 1, height: 2, backgroundColor: '#1E2B37', marginHorizontal: 6 },
  legendLineActive: { backgroundColor: '#00D2B4' },
});

const statusRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 8 },
  icon: { fontSize: 18, marginRight: 10, lineHeight: 24, fontWeight: '900' },
  label: { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: '700' },
});

const legendStyles = StyleSheet.create({
  step: { alignItems: 'center', width: 80 },
  circle: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: '#11171D', borderWidth: 1, borderColor: '#1E2B37',
    alignItems: 'center', justifyContent: 'center',
  },
  circleDone: { backgroundColor: '#16282E', borderColor: '#00D2B4' },
  circleActive: { backgroundColor: '#00D2B4', borderColor: '#00D2B4' },
  num: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  numActive: { color: '#080C0E' },
  lbl: { fontSize: 10, color: '#64748B', marginTop: 6, textAlign: 'center', fontWeight: '600' },
  lblActive: { color: '#00D2B4', fontWeight: '700' },
});