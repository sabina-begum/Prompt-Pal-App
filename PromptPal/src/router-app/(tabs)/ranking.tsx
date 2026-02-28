import { StyleSheet, Text, View } from 'react-native';

export default function RouterIsolateRankingTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ranking (Placeholder)</Text>
      <Text style={styles.body}>Ranking data queries are intentionally excluded for isolation.</Text>
    </View>
  );
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
