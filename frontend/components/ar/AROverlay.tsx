import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useSceneStore } from '../../store/sceneStore';

/**
 * AROverlay — handles ONLY the scan-phase animated overlays:
 *   - Sweeping scan line (ANALYZING state)
 *   - Brief flash effect on scan trigger
 *
 * All post-analysis AR rendering (markers, labels, connectors) is handled
 * exclusively by AROverlayLayer + arTrackingStore.
 */
export function AROverlay() {
  const analysisStatus = useSceneStore((s) => s.analysisStatus);
  const showScan = analysisStatus === 'analyzing';

  if (!showScan) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(500)}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <ScanLine />
    </Animated.View>
  );
}

function ScanLine() {
  const { height } = useWindowDimensions();
  const scanY = useSharedValue(-2);

  useEffect(() => {
    scanY.value = withRepeat(
      withSequence(
        withTiming(height, { duration: 1800 }),
        withTiming(-2,     { duration: 0 }),
      ),
      -1,
    );
    return () => { scanY.value = -2; };
  }, [height]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value }],
  }));

  return <Animated.View style={[styles.scanLine, style]} />;
}

const styles = StyleSheet.create({
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(96,165,250,0.75)',
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
});
