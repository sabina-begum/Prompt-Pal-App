import { View, Text, StyleSheet } from 'react-native';

const SAFE_MODE = process.env.EXPO_PUBLIC_SAFE_MODE === '1';
const BOOT_MODE = (process.env.EXPO_PUBLIC_BOOT_MODE || 'full').toLowerCase();

function SafeModeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SAFE MODE</Text>
      <Text style={styles.body}>
        The app is running in safe mode to isolate a startup crash.
      </Text>
      <Text style={styles.body}>
        If you can see this screen, the crash is in a subsystem that we can re-enable one by one.
      </Text>
    </View>
  );
}

export default function RootLayout() {
  if (SAFE_MODE || BOOT_MODE === 'safe') {
    return <SafeModeScreen />;
  }

  if (BOOT_MODE === 'gesture') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const GestureRoot = require('../lib/GestureRoot').default;
    return <GestureRoot />;
  }

  if (BOOT_MODE === 'router') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RouterRoot = require('../lib/RouterRoot').default;
    return <RouterRoot />;
  }

  if (BOOT_MODE === 'clerk') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ClerkRoot = require('../lib/ClerkRoot').default;
    return <ClerkRoot />;
  }

  if (BOOT_MODE === 'convex') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ConvexRoot = require('../lib/ConvexRoot').default;
    return <ConvexRoot />;
  }

  if (BOOT_MODE === 'full-lite') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const NormalRootLite = require('../lib/NormalRootLite').default;
    return <NormalRootLite />;
  }

  // Lazy-load the normal root to avoid importing native modules in SAFE_MODE.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const NormalRoot = require('../lib/NormalRoot').default;
  return <NormalRoot />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: '#C7C7C7',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
});
