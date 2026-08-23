import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const PATIENT_HISTORY_KEY = '@oralcare_patient_history';

export type PatientRecord = {
  id: string;
  patientName: string;
  age: string;
  phone?: string;
  imageUri?: string;
  qualityStatus?: 'pending' | 'passed' | 'failed';
  qualityReason?: string;
  qualityAllFailed?: string[];
  riskCategory?: 'low' | 'medium' | 'high' | 'cannot_assess' | string;
  confidence?: number;
  blurScore?: number;
  brightnessScore?: number;
  glareAreaPct?: number;
  framingConfidence?: number;
  cannotAssess?: boolean;
  cannotAssessReason?: string;
  modelVersion?: string;
  caseId?: string;
  createdAt: string;
};

/**
 * Copies a captured camera image into the app's persistent
 * document directory so it remains available offline.
 */
export async function persistPatientImage(
  patientId: string,
  sourceUri: string
): Promise<string> {
  try {
    if (!FileSystem.documentDirectory) {
      throw new Error('Persistent document directory is unavailable.');
    }

    const extension =
      sourceUri.split('.').pop()?.split('?')[0] || 'jpg';

    const destinationUri =
      `${FileSystem.documentDirectory}patient_${patientId}.${extension}`;

    const existingFile = await FileSystem.getInfoAsync(destinationUri);

    if (!existingFile.exists) {
      await FileSystem.copyAsync({
        from: sourceUri,
        to: destinationUri,
      });
    }

    return destinationUri;
  } catch (error) {
    console.error('Unable to persist patient image:', error);
    throw error;
  }
}

export async function savePatientRecord(
  patient: PatientRecord
): Promise<void> {
  try {
    const existingData = await AsyncStorage.getItem(
      PATIENT_HISTORY_KEY
    );

    const existingPatients: PatientRecord[] = existingData
      ? JSON.parse(existingData)
      : [];

    const updatedPatients = [patient, ...existingPatients];

    await AsyncStorage.setItem(
      PATIENT_HISTORY_KEY,
      JSON.stringify(updatedPatients)
    );
  } catch (error) {
    console.error('Unable to save patient record:', error);
    throw error;
  }
}

export async function getPatientHistory(): Promise<
  PatientRecord[]
> {
  try {
    const storedData = await AsyncStorage.getItem(
      PATIENT_HISTORY_KEY
    );

    if (!storedData) {
      return [];
    }

    return JSON.parse(storedData);
  } catch (error) {
    console.error('Unable to load patient history:', error);
    return [];
  }
}

export async function updatePatientRecord(
  id: string,
  updates: Partial<PatientRecord>
): Promise<void> {
  try {
    const patients = await getPatientHistory();

    let found = false;
    const updatedPatients = patients.map((patient) => {
      if (patient.id === id) {
        found = true;
        return { ...patient, ...updates };
      }
      return patient;
    });

    if (!found) {
      // Upsert: Create entry if not found so AI screening result is never lost
      const newRecord: PatientRecord = {
        id,
        patientName: updates.patientName || 'Clinical Subject',
        age: updates.age || '40',
        phone: updates.phone,
        createdAt: updates.createdAt || new Date().toISOString(),
        ...updates,
      };
      updatedPatients.unshift(newRecord);
    }

    await AsyncStorage.setItem(
      PATIENT_HISTORY_KEY,
      JSON.stringify(updatedPatients)
    );
  } catch (error) {
    console.error('Unable to update patient record:', error);
    throw error;
  }
}

export async function clearPatientHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PATIENT_HISTORY_KEY);
  } catch (error) {
    console.error('Unable to clear patient history:', error);
    throw error;
  }
}