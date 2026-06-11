import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, RoundedRect, Line, Paint, DashPathEffect } from '@shopify/react-native-skia';
import Animated, {
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  useAnimatedStyle,
  FadeIn,
  FadeOut
} from 'react-native-reanimated';
import { useSceneStore } from '../../store/sceneStore';
import { mapCameraBoxToScreen } from '../../src/utils/cameraProjection';

const TYPE_COLOR = {
  primary_hazard:    '#ef4444', // red
  threat_multiplier: '#fb923c', // orange
  mitigation_tool:   '#4ade80', // green
  neutral_context:   '#94a3b8', // slate
};

function ScanningOverlay() {
  const { width, height } = useWindowDimensions();
  const scanY = useSharedValue(0);

  useEffect(() => {
    scanY.value = withRepeat(
      withSequence(
        withTiming(height, { duration: 2200 }),
        withTiming(0, { duration: 0 })
      ),
      -1
    );
    return () => { scanY.value = 0; };
  }, [height]);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(600)}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Animated.View style={[styles.scanLine, lineStyle]} />
    </Animated.View>
  );
}

export function AROverlay() {
  const { width, height } = useWindowDimensions();
  const { 
    spatial_targets, 
    primary_hazard, 
    original_bbox, 
    fallbackMode,
    analysisStatus 
  } = useSceneStore();

  // Pulse animation for primary hazard
  const pulseWidth = useSharedValue(2);
  
  useEffect(() => {
    pulseWidth.value = withRepeat(
      withSequence(
        withTiming(4, { duration: 700 }),
        withTiming(2, { duration: 700 })
      ),
      -1,
      true
    );
  }, []);

  if (fallbackMode) {
    return null; // clear all AR boxes
  }

  const showScan = analysisStatus === 'analyzing';
  const showBoxes = analysisStatus === 'success';

  // For MVP, we assume a standard 1080p camera sensor feed (portrait orientation)
  // Real implementation would pull this dynamically from useCameraDevice() format.
  const CAMERA_W = 1080;
  const CAMERA_H = 1920;

  // Compute primary box center if available
  let primaryCenter = null;
  let screenBox = null;
  
  if (original_bbox && original_bbox.length === 4) {
    screenBox = mapCameraBoxToScreen(CAMERA_W, CAMERA_H, width, height, original_bbox);
    primaryCenter = {
      x: screenBox.x + screenBox.width / 2,
      y: screenBox.y + screenBox.height / 2
    };
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {showScan && <ScanningOverlay />}

      {showBoxes && (
        <Canvas style={StyleSheet.absoluteFill}>
          {/* Render Primary Hazard Box */}
          {screenBox && (
            <RoundedRect
              x={screenBox.x}
              y={screenBox.y}
              width={screenBox.width}
              height={screenBox.height}
              r={4}
              color={TYPE_COLOR.primary_hazard}
              style="stroke"
              strokeWidth={2} // Would use animated value here in advanced Skia setup
            />
          )}

          {/* Render Contextual Spatial Targets */}
          {spatial_targets.map(tgt => {
            const box = mapCameraBoxToScreen(CAMERA_W, CAMERA_H, width, height, tgt.box_2d);
            const color = TYPE_COLOR[tgt.type];
            const tgtCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

            return (
              <React.Fragment key={tgt.id}>
                {/* Connector Line to Primary */}
                {primaryCenter && (
                  <Line
                    p1={primaryCenter}
                    p2={tgtCenter}
                    color={color}
                    style="stroke"
                    strokeWidth={1.5}
                  >
                    <Paint style="stroke" color={color} strokeWidth={1.5}>
                      <DashPathEffect intervals={[6, 4]} />
                    </Paint>
                  </Line>
                )}

                {/* Target Bounding Box */}
                <RoundedRect
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  r={4}
                  color={color}
                  style="stroke"
                  strokeWidth={2}
                />
              </React.Fragment>
            );
          })}
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(96,165,250,0.7)',
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  }
});
