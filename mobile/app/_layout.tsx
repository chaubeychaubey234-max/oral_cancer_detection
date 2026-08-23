import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RootErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={fallbackStyles.container}>
          <Text style={fallbackStyles.icon}>⚠️</Text>
          <Text style={fallbackStyles.title}>Application Error</Text>
          <Text style={fallbackStyles.message}>
            {this.state.error?.message || 'An unexpected error occurred during rendering.'}
          </Text>
          <TouchableOpacity
            style={fallbackStyles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={fallbackStyles.buttonText}>Restart Sequence</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootErrorBoundary>
        <StatusBar style="light" />

        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#080C0E' },
          }}
        >
          <Stack.Screen name="registration" />
          <Stack.Screen name="camera" />
          <Stack.Screen name="quality-check" />
          <Stack.Screen name="results" />
          <Stack.Screen name="modal" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </RootErrorBoundary>
    </SafeAreaProvider>
  );
}

const fallbackStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C0E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#F8FAFC', marginBottom: 8 },
  message: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 24, lineHeight: 18 },
  button: {
    backgroundColor: '#00D2B4',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  buttonText: { color: '#080C0E', fontSize: 14, fontWeight: '800' },
});