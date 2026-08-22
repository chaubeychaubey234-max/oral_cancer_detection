import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="registration" />
        <Stack.Screen name="examination" />
        <Stack.Screen name="camera" />
        <Stack.Screen name="quality-check" />
        <Stack.Screen name="modal" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}