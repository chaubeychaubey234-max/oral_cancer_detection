import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { savePatientRecord } from '../storage/patientStorage';

export default function RegistrationScreen() {
  const router = useRouter();

  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');

  const handleContinue = async () => {
    const name = patientName.trim();
    const patientAge = age.trim();
    const patientPhone = phone.trim();

    if (!name || !patientAge) {
      Alert.alert(
        'Required information',
        'Please enter the patient name and age.'
      );
      return;
    }

    const patientId = `P-${Date.now()}`;

    try {
      await savePatientRecord({
        id: patientId,
        patientName: name,
        age: patientAge,
        phone: patientPhone,
        qualityStatus: 'pending',
        createdAt: new Date().toISOString(),
      });

      router.push({
        pathname: '/examination',
        params: {
          patientId,
          patientName: name,
          age: patientAge,
          phone: patientPhone,
        },
      });
    } catch (error) {
      Alert.alert(
        'Unable to save',
        'The patient information could not be saved locally. Please try again.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>OralCare</Text>
            <Text style={styles.section}>PATIENT REGISTRATION</Text>
          </View>

          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>1 / 4</Text>
          </View>
        </View>

        {/* Intro */}
        <View style={styles.intro}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>+</Text>
          </View>

          <Text style={styles.title}>Patient registration</Text>

          <Text style={styles.subtitle}>
            Enter a few basic details before starting the oral examination.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Patient details</Text>

          <View style={styles.field}>
            <Text style={styles.label}>
              Full name <Text style={styles.required}>*</Text>
            </Text>

            <TextInput
              value={patientName}
              onChangeText={setPatientName}
              placeholder="Enter full name"
              placeholderTextColor="#9AA8AD"
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>
                Age <Text style={styles.required}>*</Text>
              </Text>

              <TextInput
                value={age}
                onChangeText={setAge}
                placeholder="Age"
                placeholderTextColor="#9AA8AD"
                style={styles.input}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>

            <View style={styles.halfField}>
              <Text style={styles.label}>Phone</Text>

              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Optional"
                placeholderTextColor="#9AA8AD"
                style={styles.input}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        {/* Information */}
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>✓</Text>
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Before we begin</Text>

            <Text style={styles.infoText}>
              Make sure the patient is comfortable and ready for the oral
              examination.
            </Text>
          </View>
        </View>

        {/* Continue */}
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.continueText}>Continue to examination</Text>
          <Text style={styles.arrow}>→</Text>
        </Pressable>

        <Text style={styles.requiredNote}>* Required fields</Text>

        {/* History placeholder */}
        <Pressable
          onPress={() =>
            Alert.alert(
              'Patient history',
              'Patient history will be available here. We will connect this screen next.'
            )
          }
          style={styles.historyButton}
        >
          <Text style={styles.historyIcon}>◷</Text>
          <Text style={styles.historyText}>View patient history</Text>
        </Pressable>

        <Text style={styles.footer}>
          Patient information is stored locally on this device for offline use.
        </Text>
      </ScrollView>
    </SafeAreaView>
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
    paddingBottom: 36,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

  stepBadge: {
    backgroundColor: '#E8F3F0',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#176B6B',
  },

  intro: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 24,
  },

  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E4F1EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  icon: {
    fontSize: 28,
    color: '#176B6B',
  },

  title: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '700',
    color: '#19323C',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#60737A',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 350,
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1EAE8',
    borderRadius: 17,
    padding: 18,
  },

  formTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#19323C',
    marginBottom: 19,
  },

  field: {
    marginBottom: 16,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
  },

  halfField: {
    flex: 1,
  },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#40565E',
    marginBottom: 7,
  },

  required: {
    color: '#176B6B',
  },

  input: {
    height: 49,
    borderWidth: 1,
    borderColor: '#D5E1DF',
    borderRadius: 10,
    backgroundColor: '#FBFCFC',
    paddingHorizontal: 13,
    fontSize: 14,
    color: '#19323C',
    marginBottom: 1,
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7F5',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },

  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DDEEE9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  infoIconText: {
    color: '#176B6B',
    fontSize: 16,
    fontWeight: '700',
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#31565B',
    marginBottom: 2,
  },

  infoText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#718187',
  },

  continueButton: {
    height: 53,
    borderRadius: 12,
    backgroundColor: '#176B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 21,
  },

  buttonPressed: {
    opacity: 0.75,
  },

  continueText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 20,
    marginLeft: 9,
  },

  requiredNote: {
    textAlign: 'center',
    color: '#87969A',
    fontSize: 10,
    marginTop: 9,
  },

  historyButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 17,
    paddingVertical: 6,
  },

  historyIcon: {
    color: '#176B6B',
    fontSize: 18,
    marginRight: 7,
  },

  historyText: {
    color: '#176B6B',
    fontSize: 12,
    fontWeight: '700',
  },

  footer: {
    color: '#87969A',
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 18,
  },
});