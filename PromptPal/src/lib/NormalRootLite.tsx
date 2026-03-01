import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ClerkProviderWrapper, useAuth } from '@/lib/clerk';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { validateEnvironment } from '@/lib/env';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { colorScheme } from 'nativewind';
import '../app/global.css';

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    'EXPO_PUBLIC_CONVEX_URL is required. Set it via EAS/environment configuration.'
  );
}

const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});

function ConvexProviderWrapper({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkConfigured = !!publishableKey && publishableKey !== 'your_clerk_publishable_key_here';

  if (!isClerkConfigured) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

export default function NormalRootLite() {
  useEffect(() => {
    validateEnvironment();
    colorScheme.set('dark');
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProviderWrapper>
        <ConvexProviderWrapper>
          <SafeAreaProvider>
            <ErrorBoundary>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(auth)" />
              </Stack>
              <StatusBar style="light" />
            </ErrorBoundary>
          </SafeAreaProvider>
        </ConvexProviderWrapper>
      </ClerkProviderWrapper>
    </GestureHandlerRootView>
  );
}
