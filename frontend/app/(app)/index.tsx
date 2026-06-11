import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CameraView } from '../../components/camera/CameraView';
import { AROverlay } from '../../components/ar/AROverlay';
import { StatusCapsule } from '../../components/capsule/StatusCapsule';
import { LeftControls } from '../../components/ui/LeftControls';
import { BottomSheet } from '../../components/sheet/BottomSheet';
import { useWebSocket } from '../../hooks/useWebSocket';

/**
 * CameraScreen — FixSight main screen.
 *
 * Layer order (bottom → top):
 *  1. Full-screen camera feed (CameraView — runs frame processor)
 *  2. AR overlay (scan line, Skia bounding boxes)
 *  3. Status capsule (top-center pill)
 *  4. Left action rail (camera flip, flash, rotate, scan/reset)
 *  5. Bottom Sheet (guidance steps from Groq scene analysis)
 *
 * useWebSocket is mounted here at the root so the connection is established
 * immediately on app open, before the first scan is triggered.
 */
export default function CameraScreen() {
  // Establish WebSocket connection on mount so it's ready when first frame fires.
  useWebSocket();

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <CameraView />
        <AROverlay />
        <StatusCapsule />
        <LeftControls />
        <BottomSheet />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
