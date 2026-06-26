import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useWorkflowStore } from '../../store/workflowStore';

export function StatusCapsule() {
  const { workflowState } = useWorkflowStore();
  const labels: Record<string, string> = {
    READY:              '🟢  Ready',
    ANALYZING:          '🔵  Analyzing...',
    HAZARDS_DISCOVERED: '🟡  Hazard Detected',
    HAZARD_FOCUSED:     '🔴  Critical Alert',
    SHEET_OPEN:         '🔴  Critical Alert',
  };
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{labels[workflowState] ?? workflowState}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(10,10,18,0.85)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    zIndex: 100,
  },
  label: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
