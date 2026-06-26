import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useWorkflowStore } from '../../store/workflowStore';
import type { SceneHazard } from '../../src/types';

// Web stub mock hazards in SceneHazard shape for dev/demo testing
const MOCK_SCENE_HAZARDS: SceneHazard[] = [
  {
    id: 'haz_0',
    title: 'Overheating Detected',
    risk_level: 'CRITICAL',
    summary: 'Possible loose connection causing breaker overload.',
    confidence: 0.98,
    primary_box: [0.20, 0.22, 0.72, 0.64],
    guidance: {
      problem: 'Circuit breaker is overheating.',
      reason: 'Overloaded circuit or loose connection.',
      why_it_matters: 'Left unaddressed, can cause an electrical fire within hours.',
      actions: [
        { id: 'step_1', stepNumber: 1, icon: 'shield-alert', title: 'Maintain safe distance', subtitle: 'Stay at least 2 metres away', isCritical: true },
        { id: 'step_2', stepNumber: 2, icon: 'zap-off', title: 'Turn off main power', subtitle: "If safe to do so", isCritical: true },
      ],
    },
    fallback_plan: 'Evacuate and call an electrician immediately.',
  },
  {
    id: 'haz_1',
    title: 'Corrosion Detected',
    risk_level: 'MEDIUM',
    summary: 'Oxidation on bus bar may increase resistance.',
    confidence: 0.84,
    primary_box: [0.30, 0.55, 0.65, 0.75],
    guidance: {
      problem: 'Corrosion on main bus bar.',
      reason: 'Moisture ingress or chemical exposure.',
      why_it_matters: 'Can escalate to overheating or partial disconnection.',
      actions: [
        { id: 'step_3', stepNumber: 1, icon: 'power-off', title: 'De-energize circuit', subtitle: 'Switch off upstream breaker', isCritical: true },
        { id: 'step_4', stepNumber: 2, icon: 'brush', title: 'Clean with wire brush', subtitle: 'Use dry non-conductive brush', isCritical: false },
      ],
    },
    fallback_plan: 'Call a licensed electrician if corrosion is extensive.',
  },
];

// Web stub for TopBar — updated for V2.1 multi-hazard workflow
export function TopBar() {
  const { workflowState, startAnalysis, onHazardsDiscovered, reset } = useWorkflowStore();
  const isReady = workflowState === 'READY';
  const isAnalyzing = workflowState === 'SCANNING';

  const handleScan = () => {
    if (isAnalyzing) return;
    if (!isReady) { reset(); return; }
    startAnalysis();
    setTimeout(() => onHazardsDiscovered(MOCK_SCENE_HAZARDS, 'haz_0'), 3000);
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handleScan}
        style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.scanText}>
          {isReady ? '⬤  Scan' : isAnalyzing ? '◌  Analyzing...' : '✕  Reset'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 100,
  },
  scanBtn: {
    backgroundColor: 'rgba(29,106,229,0.9)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  scanText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
