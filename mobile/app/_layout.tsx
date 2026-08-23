import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
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
    </>
  );
}