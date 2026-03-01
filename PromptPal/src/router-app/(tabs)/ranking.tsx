import { StyleSheet, Text, View } from 'react-native';

type RankingIsoStage = 'placeholder' | 'full';

const RANKING_ISO_STAGE = (
  process.env.EXPO_PUBLIC_RANKING_ISO_STAGE || 'placeholder'
).toLowerCase() as RankingIsoStage;

function PlaceholderProbe() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ranking (Placeholder)</Text>
      <Text style={styles.body}>Ranking data queries are intentionally excluded for isolation.</Text>
    </View>
  );
}

export default function RouterIsolateRankingTab() {
  if (RANKING_ISO_STAGE === 'full') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FullRankingScreen = require('../../app/(tabs)/ranking').default;
    return <FullRankingScreen />;
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
});
