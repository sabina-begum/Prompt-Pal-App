import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';

type LibraryIsoStage = 'placeholder' | 'clerk' | 'convex' | 'full';

const LIBRARY_ISO_STAGE = (
  process.env.EXPO_PUBLIC_LIBRARY_ISO_STAGE || 'clerk'
).toLowerCase() as LibraryIsoStage;
const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const CLERK_CONFIGURED = !!CLERK_KEY && CLERK_KEY !== 'your_clerk_publishable_key_here';

function PlaceholderProbe() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Library Placeholder Probe</Text>
      <Text style={styles.body}>No Clerk or Convex dependencies loaded.</Text>
    </View>
  );
}

function ClerkProbe() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setTimedOut(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setTimedOut(true);
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [isLoaded]);

  if (!isLoaded && !timedOut) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.body}>Loading Clerk probe...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Library Clerk Probe</Text>
      <Text style={styles.body}>Signed in: {isSignedIn ? 'yes' : 'no'}</Text>
      <Text style={styles.body}>User: {user?.id ? 'present' : 'none'}</Text>
      <Text style={styles.body}>Clerk loaded: {isLoaded ? 'yes' : 'no'}</Text>
      {!isLoaded && timedOut ? (
        <Text style={styles.body}>
          Clerk load timeout reached. Probe recovered without crashing.
        </Text>
      ) : null}
    </View>
  );
}

function ConvexProbe() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  // Intentionally lazy-load Convex imports so each probe stage isolates one layer.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useQuery } = require('convex/react') as { useQuery: Function };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { api } = require('../../../convex/_generated/api.js') as {
    api: Record<string, any>;
  };

  const data = useQuery(
    api.queries.getLibraryData,
    isSignedIn && user?.id
      ? { userId: user.id, appId: 'prompt-pal' }
      : 'skip'
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Library Convex Probe</Text>
      <Text style={styles.body}>Query state: {data === undefined ? 'loading' : 'ready'}</Text>
    </View>
  );
}

export default function RouterIsolateLibraryTab() {
  if (LIBRARY_ISO_STAGE === 'full') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FullLibraryScreen = require('../../app/(tabs)/library').default;
    return <FullLibraryScreen />;
  }

  if (LIBRARY_ISO_STAGE === 'convex') {
    return <ConvexProbe />;
  }

  if (!CLERK_CONFIGURED) {
    return <PlaceholderProbe />;
  }

  if (LIBRARY_ISO_STAGE === 'placeholder') {
    return <PlaceholderProbe />;
  }

  return <ClerkProbe />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: '#C7C7C7',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
});
