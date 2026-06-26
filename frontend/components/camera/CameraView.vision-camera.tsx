import React, { useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useSharedValue, Worklets } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useWorkflowStore } from '../../store/workflowStore';
import { useSceneStore } from '../../store/sceneStore';
import { useWsStore } from '../../store/wsStore';
import { assignStableId } from '../../src/utils/iouTracker';
import { AROverlayLayer } from '../ar/AROverlayLayer';
import { useARTrackingStore } from '../../store/arTrackingStore';

// ── Component ────────────────────────────────────────────────────────────
export function CameraView() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const { facing, torchEnabled, setCameraRef, cameraRef, startAnalysis } = useWorkflowStore();
  const { markAnalysisSent, analysisStatus, reset: resetScene } = useSceneStore();
  const sendSceneFrame = useWsStore((s) => s.sendSceneFrame);

  const localCameraRef = useRef<Camera>(null);
  const device = useCameraDevice(facing);

  // TFLite model — file exists at assets/models/detect.tflite
  const model = useTensorflowModel(
    require('../../assets/models/detect.tflite')
  );

  // resize plugin instance (worklet-safe, memory managed)
  const { resize } = useResizePlugin();

  // ── Manual scan trigger sync (optimized)
  const manualScanTick = useWorkflowStore((state) => state.manualScanTick);
  const manualTriggerSV = useSharedValue(0);
  useEffect(() => {
    manualTriggerSV.value = manualScanTick;
  }, [manualScanTick, manualTriggerSV]);

  // ── Permission request on mount
  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // ── Watchdog timer (increased to 30s to avoid false failures on slow networks)
  useEffect(() => {
    if (analysisStatus !== 'analyzing') return;
    const t = setTimeout(() => {
      resetScene();
      useWorkflowStore.getState().reset();
      console.warn('[FixSight] Analysis timed out (30s) — resetting to READY');
    }, 30000);
    return () => clearTimeout(t);
  }, [analysisStatus, resetScene]);

  // ── UI state update — separate from network layer
  const onStableDetection = useCallback(
    async (hazardBbox: number[]) => {
      try {
        if (!localCameraRef.current) return;
        
        console.log('[FixSight] Found stable object. Taking photo...');
        
        // Instead of doing heavy RGB-to-Base64 inside the Worklet thread,
        // we let the native camera take a high-speed JPEG directly.
        // This completely avoids all JSI TypedArray memory-drop bugs!
        const photo = await localCameraRef.current.takePhoto({
          flash: 'off',
        });
        
        // Convert to Base64 using a standard JS FileReader asynchronously
        const response = await fetch(`file://${photo.path}`);
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onloadend = () => {
          const base64Str = (reader.result as string).split(',')[1];
          console.log(`[FixSight] Photo encoded! Base64 size: ${base64Str.length}`);
          
          sendSceneFrame(base64Str, hazardBbox);
          
          // Only update UI state after successfully queueing the websocket send
          markAnalysisSent();
          startAnalysis();
        };
        
        reader.onerror = (e) => console.error('[FixSight] FileReader error:', e);
        reader.readAsDataURL(blob);
        
      } catch (err) {
        console.error('[FixSight] Failed to take/send photo:', err);
      }
    },
    [markAnalysisSent, sendSceneFrame, startAnalysis]
  );
  
  const onStableDetectionJS = Worklets.createRunOnJS(onStableDetection);

  // ── Feed TFLite detections into arTrackingStore every frame (tracker update)
  // This keeps AR markers locked to moving objects after the VLM initializes them.
  const updateTrackerFromDetections = useCallback(
    (detections: { id: string; box: number[] }[]) => {
      useARTrackingStore.getState().updateFromTracker(detections);
    },
    [],
  );
  const updateTrackerJS = Worklets.createRunOnJS(updateTrackerFromDetections);

  // ── Shared worklet state (persists between frames via useSharedValue)
  const stableCount   = useSharedValue<Record<string, number>>({});
  const lastBboxes    = useSharedValue<Record<string, number[]>>({});
  const lastSeenFrame = useSharedValue<Record<string, number>>({});
  const lastSentAt    = useSharedValue(0);
  const frameCount    = useSharedValue(0);

  // ID counter owned by JS-side shared value, not module scope
  const nextIdCounter = useSharedValue(1);

  const THRESHOLD     = 5;    // Trigger fast: 5 consecutive frames (~150ms)
  const SEND_COOLDOWN = 3000; // ms minimum between sends

  // ─────────────────────────────────────────────────────────────────────────
  // useFrameProcessor runs off the UI thread in a JSI worklet context.
  // ─────────────────────────────────────────────────────────────────────────
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      frameCount.value += 1;

      // Throttle TFLite execution to ~20 FPS (assuming 60fps camera) 
      // This prevents CPU lockup and thermal throttling on Android.
      if (frameCount.value % 3 !== 0) return;

      // ── Sub-task 2a: Garbage collection ─────────────────────────────────
      if (frameCount.value % 60 === 0) {
        const activeIds = Object.keys(lastBboxes.value);
        const stableKeys = Object.keys(stableCount.value);
        const nextStable: Record<string, number> = {};
        
        for (let i = 0; i < stableKeys.length; i++) {
          const key = stableKeys[i];
          let found = false;
          for (let j = 0; j < activeIds.length; j++) {
            if (activeIds[j] === key) {
              found = true;
              break;
            }
          }
          if (found) {
            nextStable[key] = stableCount.value[key];
          }
        }
        stableCount.value = nextStable;
      }

      // ── Sub-task 2b: TFLite local detection ─────────────────────────────
      if (model.state === 'loading' || model.state === 'error') return;
      const tfModel = model.model;
      if (tfModel == null) return;

      try {
        // Resize frame to 300×300 RGB uint8 for MobileNetSSD
        const tensor = resize(frame, {
          scale: { width: 300, height: 300 },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });

        // MobileNetSSD output tensors
        const outputs = tfModel.runSync([tensor]);

        const locations = outputs[0] as Float32Array;
        const scores    = outputs[2] as Float32Array;
        const numDets   = Math.round((outputs[3] as Float32Array)[0]);

        const isManual = manualTriggerSV.value > 0;
        
        // ── MANUAL OVERRIDE ONLY (Triggers exactly one analysis) ──
        if (isManual) {
            manualTriggerSV.value = 0; // reset
            lastSentAt.value = Date.now();
            
            // Send empty bbox or the highest confidence auto-tracked bbox if available
            // For simplicity, we send empty to let VLM analyze the whole scene
            onStableDetectionJS([]);
            return;
        }

        // ── AUTO TRACKING — collect all detected boxes for tracker update ──
        const frameDetections: { id: string; box: number[] }[] = [];

        for (let i = 0; i < numDets; i++) {
          const score = scores[i];
          if (score < 0.45) continue;

          const y1 = locations[i * 4 + 0];
          const x1 = locations[i * 4 + 1];
          const y2 = locations[i * 4 + 2];
          const x2 = locations[i * 4 + 3];
          const bbox = [x1, y1, x2, y2];

          const { id, nextIdCounter: newCounter } = assignStableId(
            bbox,
            lastBboxes.value,
            lastSeenFrame.value,
            frameCount.value,
            nextIdCounter.value
          );
          nextIdCounter.value = newCounter;

          const count = (stableCount.value[id] ?? 0) + 1;
          stableCount.value = { ...stableCount.value, [id]: count };
          frameDetections.push({ id, box: bbox });
        }

        // Push detections to JS thread for arTrackingStore smooth update
        if (frameDetections.length > 0) {
          updateTrackerJS(frameDetections);
        }
      } catch (err: any) {
        console.log('[FrameProcessor Error]:', err.message || err);
      }
    },
    [model, resize]
  );

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Requesting Camera Permission…</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No camera device found.</Text>
      </View>
    );
  }

  return (
    <>
      <Camera
        ref={(ref) => {
          (localCameraRef as any).current = ref;
          if (ref !== cameraRef) setCameraRef(ref);
        }}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
        frameProcessor={frameProcessor}
        torch={torchEnabled ? 'on' : 'off'}
      />
      
      {/* 2.5D AR Spatial Overlays */}
      <AROverlayLayer />
      
      {/* Scan Flash Effect */}
      {analysisStatus === 'analyzing' && (
        <View style={[StyleSheet.absoluteFill, styles.flash]} pointerEvents="none" />
      )}
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
  flash: { backgroundColor: 'rgba(255,255,255,0.2)' },
});
