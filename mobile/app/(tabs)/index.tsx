import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function HomeScreen() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');

  const canContinue = name.trim().length > 0 && age.trim().length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topSection}>
            <View style={styles.brandMark}>
              <View style={styles.brandDot} />
            </View>

            <Text style={styles.brandName}>OralCare</Text>
            <Text style={styles.screenTitle}>Patient registration</Text>
            <Text style={styles.intro}>
              Enter a few details to begin the oral examination.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Patient details</Text>

            <View style={styles.field}>
              <Text style={styles.label}>
                Full name <Text style={styles.required}>*</Text>
              </Text>

              <TextInput
                style={styles.input}
                placeholder="e.g. Ananya Sharma"
                placeholderTextColor="#91A0A5"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.ageField]}>
                <Text style={styles.label}>
                  Age <Text style={styles.required}>*</Text>
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Age"
                  placeholderTextColor="#91A0A5"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  maxLength={3}
                  returnKeyType="next"
                />
              </View>

              <View style={[styles.field, styles.phoneField]}>
                <Text style={styles.label}>Phone</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Optional"
                  placeholderTextColor="#91A0A5"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Before we begin</Text>
              <Text style={styles.infoText}>
                Make sure the patient is comfortable and ready for the oral
                examination.
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!canContinue}
              style={[
                styles.continueButton,
                !canContinue && styles.continueButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.continueText,
                  !canContinue && styles.continueTextDisabled,
                ]}
              >
                Continue
              </Text>

              <Text
                style={[
                  styles.arrow,
                  !canContinue && styles.continueTextDisabled,
                ]}
              >
                →
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.privacyText}>
            Patient information should be handled securely and only used for
            the examination.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    backgroundColor: '#F6F9F8',
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 28,
  },

  topSection: {
    marginBottom: 26,
  },

  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#176B6B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },

  brandName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#176B6B',
    letterSpacing: 0.3,
    marginBottom: 10,
  },

  screenTitle: {
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '700',
    color: '#19323C',
    letterSpacing: -0.5,
  },

  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: '#60737A',
    marginTop: 8,
    maxWidth: 360,
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E9E7',
    borderRadius: 18,
    padding: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#19323C',
    marginBottom: 22,
  },

  field: {
    marginBottom: 18,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
  },

  ageField: {
    flex: 0.8,
  },

  phoneField: {
    flex: 1.2,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#40565E',
    marginBottom: 8,
  },

  required: {
    color: '#C65A5A',
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#D7E2E0',
    borderRadius: 10,
    backgroundColor: '#FBFCFC',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#19323C',
  },

  infoBox: {
    backgroundColor: '#F1F7F5',
    borderRadius: 12,
    padding: 14,
    marginTop: 2,
    marginBottom: 20,
  },

  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#176B6B',
    marginBottom: 4,
  },

  infoText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#60737A',
  },

  continueButton: {
    height: 52,
    borderRadius: 11,
    backgroundColor: '#176B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  continueButtonDisabled: {
    backgroundColor: '#E0E7E5',
  },

  continueText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  continueTextDisabled: {
    color: '#98A6A3',
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 19,
    marginLeft: 9,
    marginTop: -1,
  },

  privacyText: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    color: '#87969A',
    marginTop: 18,
    paddingHorizontal: 14,
  },
});