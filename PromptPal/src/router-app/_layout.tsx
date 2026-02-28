import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ClerkProviderWrapper, useAuth } from '@/lib/clerk';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import '../app/global.css';

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error('EXPO_PUBLIC_CONVEX_URL is required for router isolation mode.');
}

const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});

const libraryStage = (process.env.EXPO_PUBLIC_LIBRARY_ISO_STAGE || 'clerk').toLowerCase();
const needsConvexProvider = libraryStage === 'convex' || libraryStage === 'full';
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured = !!publishableKey && publishableKey !== 'your_clerk_publishable_key_here';

function RouterIsolationProviders({ children }: { children: ReactNode }) {
  if (!needsConvexProvider) {
    return <>{children}</>;
  }

  if (!isClerkConfigured) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

export default function RouterIsolateLayout() {
  return (
    <ClerkProviderWrapper>
      <RouterIsolationProviders>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </RouterIsolationProviders>
    </ClerkProviderWrapper>
  );
}
