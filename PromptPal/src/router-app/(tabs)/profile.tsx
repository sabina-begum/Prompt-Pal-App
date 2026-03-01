import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

type ProfileIsoStage = 'placeholder' | 'full';

const PROFILE_ISO_STAGE = (
  process.env.EXPO_PUBLIC_PROFILE_ISO_STAGE || 'placeholder'
).toLowerCase() as ProfileIsoStage;

function PlaceholderProbe() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Isolation</Text>
      <Text style={styles.body}>Clerk loaded: {isLoaded ? 'yes' : 'no'}</Text>
      <Text style={styles.body}>Signed in: {isSignedIn ? 'yes' : 'no'}</Text>
      {!isSignedIn ? (
        <Pressable style={styles.button} onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={styles.buttonText}>Go To Sign In</Text>
        </Pressable>
      ) : (
        <Text style={styles.body}>Session is active.</Text>
      )}
    </View>
  );
}

export default function RouterIsolateProfileTab() {
  if (PROFILE_ISO_STAGE === 'full') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FullProfileScreen = require('../../app/(tabs)/profile').default;
    return <FullProfileScreen />;
  }

  return <PlaceholderProbe />;
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
  },
  button: {
    marginTop: 16,
    backgroundColor: '#FF6B00',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
