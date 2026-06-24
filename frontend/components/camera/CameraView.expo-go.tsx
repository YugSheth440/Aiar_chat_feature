import React, { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CameraView as ExpoCamera, useCameraPermissions } from 'expo-camera';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useWorkflowStore } from '../../store/workflowStore';
import { useSceneStore } from '../../store/sceneStore';
import { useWsStore } from '../../store/wsStore';
import { AROverlayLayer } from '../ar/AROverlayLayer';
import { Gyroscope } from 'expo-sensors';
import { arOffsetX, arOffsetY } from '../../store/arTrackingStore';

// ── Futuristic Scanning Laser Component (Video-Analysis Illusion) ─────────────
function ScanningLaser({ active }: { active: boolean }) {
  const { height, width } = useWindowDimensions();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (active) {
      translateY.value = 0;
      translateY.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      translateY.value = 0;
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value * (height - 220) + 110 }],
  }));

  if (!active) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(250)}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {/* Sci-fi blue HUD overlay scan tint */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(59, 130, 246, 0.04)' }]} />
      
      {/* Glowing Moving scan line */}
      <Animated.View style={[styles.laserLine, { width }, animatedStyle]}>
        <View style={styles.laserGlow} />
      </Animated.View>
    </Animated.View>
  );
}

// ── Component for Expo Go ───────────────────────────────────────────────────
export function CameraView() {
  const [permission, requestPermission] = useCameraPermissions();
  const { facing, torchEnabled, setCameraRef, startAnalysis } = useWorkflowStore();
  const { markAnalysisSent, analysisStatus, reset: resetScene } = useSceneStore();
  const sendSceneFrame = useWsStore((s) => s.sendSceneFrame);

  const localCameraRef = useRef<any>(null);

  const onCameraRef = useCallback((ref: any) => {
    localCameraRef.current = ref;
    if (ref) {
      const adapterRef = {
        takePhoto: async (options?: any) => {
          console.log('[FixSight] JSI Adapter: Capturing frame for Ask AI...');
          const photo = await ref.takePictureAsync({
            quality: 0.5,
            skipProcessing: true,
            shutterSound: false,
          });
          if (!photo) throw new Error('Failed to capture image in Expo Go adapter');
          const cleanPath = photo.uri.replace('file://', '');
          return {
            path: cleanPath,
          };
        },
      };
      setCameraRef(adapterRef);
    } else {
      setCameraRef(null);
    }
  }, [setCameraRef]);

  // Request permissions on mount
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Gyroscope tracking for dynamic camera-motion based AR overlays on Expo Go
  useEffect(() => {
    let subscription: any = null;
    Gyroscope.setUpdateInterval(16); // ~60Hz update rate
    
    subscription = Gyroscope.addListener((data) => {
      // Scale factor to map angular velocity (rad/s) to screen pixels
      const scale = 500;
      
      // Pitch/Yaw updates to offset camera motion
      arOffsetX.value = arOffsetX.value - (data.y * 0.016) * scale;
      arOffsetY.value = arOffsetY.value + (data.x * 0.016) * scale;
    });

    return () => {
      if (subscription) subscription.remove();
      arOffsetX.value = 0;
      arOffsetY.value = 0;
    };
  }, []);

  // Watchdog timer (similar to original Vision Camera setup)
  useEffect(() => {
    if (analysisStatus !== 'analyzing') return;
    const t = setTimeout(() => {
      resetScene();
      useWorkflowStore.getState().reset();
      console.warn('[FixSight] Analysis timed out (30s) — resetting to READY');
    }, 30000);
    return () => clearTimeout(t);
  }, [analysisStatus, resetScene]);

  // Listen to manual scan trigger from the UI scan button
  const manualScanTick = useWorkflowStore((state) => state.manualScanTick);
  useEffect(() => {
    if (manualScanTick > 0 && localCameraRef.current) {
      handleScan();
    }
  }, [manualScanTick]);

  const handleScan = async () => {
    try {
      if (!localCameraRef.current) return;
      console.log('[FixSight] Expo Go Mode: Capturing scan frame...');
      
      resetScene();
      startAnalysis();

      // Take a picture and get base64 directly from expo-camera
      const photo = await localCameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: true,
        shutterSound: false,
      });

      if (photo && photo.base64) {
        console.log(`[FixSight] Frame captured successfully! Base64 size: ${photo.base64.length}`);
        
        // Send base64 frame to backend via WebSocket (empty bounding box for general VLM query)
        sendSceneFrame(photo.base64, []);
        
        markAnalysisSent();
      } else {
        console.error('[FixSight] Failed to generate base64 string from captured picture.');
        useSceneStore.getState().reset();
        useWorkflowStore.getState().reset();
      }
    } catch (err) {
      console.error('[FixSight] Error during expo-camera capture:', err);
      useSceneStore.getState().reset();
      useWorkflowStore.getState().reset();
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Requesting Camera Permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission is required to use this app.</Text>
      </View>
    );
  }

  const isAnalyzing = analysisStatus === 'analyzing';

  return (
    <>
      <ExpoCamera
        ref={onCameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        enableTorch={torchEnabled}
      />
      
      {/* 2.5D AR Spatial Overlays */}
      <AROverlayLayer />
      
      {/* Premium Video-Scanning Illusion Laser Effect */}
      <ScanningLaser active={isAnalyzing} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  laserLine: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99,
  },
  laserGlow: {
    position: 'absolute',
    top: -24,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
});
