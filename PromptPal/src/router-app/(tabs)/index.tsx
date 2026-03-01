import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';

type HomeIsoStage = 'placeholder' | 'auth' | 'store' | 'convex' | 'usage' | 'full';

const HOME_ISO_STAGE = (
  process.env.EXPO_PUBLIC_HOME_ISO_STAGE || 'auth'
).toLowerCase() as HomeIsoStage;

function PlaceholderProbe() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Placeholder Probe</Text>
      <Text style={styles.body}>No auth, store, or Convex dependencies loaded.</Text>
    </View>
  );
}

function AuthProbe() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.body}>Loading Home auth probe...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Auth Probe</Text>
      <Text style={styles.body}>Signed in: {isSignedIn ? 'yes' : 'no'}</Text>
      <Text style={styles.body}>User: {user?.id ? 'present' : 'none'}</Text>
      <Text style={styles.body}>Auth loaded: yes</Text>
    </View>
  );
}

function StoreProbe() {
  // Intentionally lazy-load user/game stores so this stage isolates store hydration.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useGameStore } = require('../../features/game/store') as {
    useGameStore: Function;
  };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useUserProgressStore } = require('../../features/user/store') as {
    useUserProgressStore: Function;
  };

  const lives = useGameStore((state: any) => state.lives);
  const level = useUserProgressStore((state: any) => state.level);
  const modules = useUserProgressStore((state: any) => state.learningModules);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Store Probe</Text>
      <Text style={styles.body}>Lives: {String(lives)}</Text>
      <Text style={styles.body}>Level: {String(level)}</Text>
      <Text style={styles.body}>Modules: {Array.isArray(modules) ? modules.length : 0}</Text>
    </View>
  );
}

function ConvexProbe() {
  // Intentionally lazy-load Convex imports so this stage isolates query hooks.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useQuery } = require('convex/react') as { useQuery: Function };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { api } = require('../../../convex/_generated/api.js') as {
    api: Record<string, any>;
  };

  // Keep this probe to a single non-auth query first.
  // We'll add auth-required queries only after this stage is stable.
  const levels = useQuery(api.queries.getLevels, { appId: 'prompt-pal' });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Convex Probe</Text>
      <Text style={styles.body}>Levels query: {levels === undefined ? 'loading' : 'ready'}</Text>
    </View>
  );
}

function UsageProbe() {
  const { isLoaded, isSignedIn } = useAuth();

  // Intentionally lazy-load Convex imports so this stage isolates auth-required query hooks.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useQuery } = require('convex/react') as { useQuery: Function };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { api } = require('../../../convex/_generated/api.js') as {
    api: Record<string, any>;
  };

  const queryArgs = isLoaded && isSignedIn ? { appId: 'prompt-pal' } : 'skip';
  const usage = useQuery(api.queries.getUserUsage, queryArgs);

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.body}>Loading Home usage probe auth state...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Usage Probe</Text>
      <Text style={styles.body}>Signed in: {isSignedIn ? 'yes' : 'no'}</Text>
      <Text style={styles.body}>Usage query: {usage === undefined ? 'loading' : 'ready'}</Text>
      {usage ? <Text style={styles.body}>Tier: {String((usage as any).tier || 'n/a')}</Text> : null}
    </View>
  );
}

export default function RouterIsolateHomeTab() {
  if (HOME_ISO_STAGE === 'full') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FullHomeScreen = require('../../app/(tabs)/index').default;
    return <FullHomeScreen />;
  }

  if (HOME_ISO_STAGE === 'convex') {
    return <ConvexProbe />;
  }

  if (HOME_ISO_STAGE === 'usage') {
    return <UsageProbe />;
  }

  if (HOME_ISO_STAGE === 'store') {
    return <StoreProbe />;
  }

  if (HOME_ISO_STAGE === 'placeholder') {
    return <PlaceholderProbe />;
  }

  return <AuthProbe />;
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
