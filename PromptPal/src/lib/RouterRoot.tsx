import { Stack } from 'expo-router';

export default function RouterRoot() {
  // Isolation build: keep router mode to the smallest possible surface.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="boot" />
    </Stack>
  );
}
