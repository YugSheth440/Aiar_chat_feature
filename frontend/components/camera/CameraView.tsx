import React, { useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useSharedValue, runOnJS } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useWorkflowStore } from '../../store/workflowStore';
import { useSceneStore } from '../../store/sceneStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { calculateIoU, assignStableId } from '../../src/utils/iouTracker';

// ─── MobileNet SSD COCO label list (80 classes + background) ──────────────
// Indices match the COCO SSD MobileNet v1 output tensor order.
const COCO_LABELS = [
  'background','person','bicycle','car','motorcycle','airplane','bus','train',
  'truck','boat','traffic light','fire hydrant','stop sign','parking meter',
  'bench','bird','cat','dog','horse','sheep','cow','elephant','bear','zebra',
  'giraffe','backpack','umbrella','handbag','tie','suitcase','frisbee','skis',
  'snowboard','sports ball','kite','baseball bat','baseball glove','skateboard',
  'surfboard','tennis racket','bottle','wine glass','cup','fork','knife','spoon',
  'bowl','banana','apple','sandwich','orange','broccoli','carrot','hot dog',
  'pizza','donut','cake','chair','couch','potted plant','bed','dining table',
  'toilet','tv','laptop','mouse','remote','keyboard','cell phone','microwave',
  'oven','toaster','sink','refrigerator','book','clock','vase','scissors',
  'teddy bear','hair drier','toothbrush',
];

// ─── Base64 encoding on JS thread ─────────────────────────────────────────
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192; // Process in 8KB chunks to avoid stack overflow and speed up 100x
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    // @ts-ignore
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

// ─── Component ────────────────────────────────────────────────────────────
export function CameraView() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const { facing, torchEnabled, setCameraRef, cameraRef, startAnalysis } =
    useWorkflowStore();
  const { markAnalysisSent, analysisStatus, reset: resetScene } = useSceneStore();
  const { sendSceneFrame } = useWebSocket();

  const device = useCameraDevice(facing);

  // ── Fix #2: TFLite model — file now exists at assets/models/detect.tflite
  const model = useTensorflowModel(
    require('../../assets/models/detect.tflite')
  );

  // ── Fix #3: resize plugin instance (worklet-safe, memory managed)
  const { resize } = useResizePlugin();

  const [manualScanTrigger, setManualScanTrigger] = React.useState(0);
  
  // Sync manual trigger from store
  useEffect(() => {
    const unsub = useWorkflowStore.subscribe((state) => {
      if (state.manualScanTick > manualScanTrigger) {
        setManualScanTrigger(state.manualScanTick);
      }
    });
    return unsub;
  }, [manualScanTrigger]);

  // ── Permission request on mount
  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // ── Fix for Test 13: 8s analysis timeout watchdog
  useEffect(() => {
    if (analysisStatus !== 'analyzing') return;
    const t = setTimeout(() => {
      resetScene();
      useWorkflowStore.getState().reset();
      console.warn('[FixSight] Analysis timed out — resetting to READY');
    }, 8000);
    return () => clearTimeout(t);
  }, [analysisStatus, resetScene]);

  // ── Step 2e: UI state update — separate from network layer
  const onStableDetection = useCallback(
    (rawBytes: Uint8Array, hazardBbox: number[]) => {
      console.log(`[FixSight] onStableDetection triggered! Received ${rawBytes.byteLength} bytes.`);
      // Convert bytes → base64 on JS thread
      const base64 = uint8ToBase64(rawBytes);
      console.log(`[FixSight] Encoded to base64 length: ${base64.length}`);
      
      markAnalysisSent();
      sendSceneFrame(base64, hazardBbox);
      startAnalysis();
    },
    [markAnalysisSent, sendSceneFrame, startAnalysis]
  );

  // ── Shared worklet state (persists between frames via useSharedValue)
  const stableCount   = useSharedValue<Record<string, number>>({});
  const lastBboxes    = useSharedValue<Record<string, number[]>>({});
  const lastSeenFrame = useSharedValue<Record<string, number>>({});
  const lastSentAt    = useSharedValue(0);
  const frameCount    = useSharedValue(0);
  const manualTriggerSV = useSharedValue(0);
  useEffect(() => {
    manualTriggerSV.value = manualScanTrigger;
  }, [manualScanTrigger, manualTriggerSV]);

  // Fix #6: ID counter owned by JS-side shared value, not module scope
  const nextIdCounter = useSharedValue(1);

  const THRESHOLD    = 5;    // Trigger fast: 5 consecutive frames (~150ms)
  const SEND_COOLDOWN = 3000; // ms minimum between sends

  // ─────────────────────────────────────────────────────────────────────────
  // useFrameProcessor runs off the UI thread in a JSI worklet context.
  // Sub-tasks: 2a (camera) → 2b (TFLite) → 2c (debounce) are here.
  // 2d (WS send) and 2e (UI state) are triggered via runOnJS.
  // ─────────────────────────────────────────────────────────────────────────
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      frameCount.value += 1;

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

        // MobileNetSSD output tensors:
        //   [0] locations  — Float32Array [1, 10, 4]  (normalized [y1,x1,y2,x2])
        //   [1] classes    — Float32Array [1, 10]
        //   [2] scores     — Float32Array [1, 10]
        //   [3] numDets    — Float32Array [1]
        const outputs = tfModel.runSync([tensor]);

        const locations = outputs[0] as Float32Array;
        const scores    = outputs[2] as Float32Array;
        const numDets   = Math.round((outputs[3] as Float32Array)[0]);

        for (let i = 0; i < numDets; i++) {
          const score = scores[i];
          if (score < 0.45) continue; // Skip low-confidence detections

          // MobileNetSSD box format: [y1, x1, y2, x2] normalized
          const y1 = locations[i * 4 + 0];
          const x1 = locations[i * 4 + 1];
          const y2 = locations[i * 4 + 2];
          const x2 = locations[i * 4 + 3];
          const bbox = [x1, y1, x2, y2]; // convert to [x1,y1,x2,y2]

          // ── Sub-task 2c: Stabilization debounce with real IoU tracking ──
          const { id, nextIdCounter: newCounter } = assignStableId(
            bbox,
            lastBboxes.value,
            lastSeenFrame.value,
            frameCount.value,
            nextIdCounter.value
          );
          // Fix #6: persist counter back into shared value
          nextIdCounter.value = newCounter;

          const count = (stableCount.value[id] ?? 0) + 1;
          // Correct spread syntax (fix from plan rev2)
          stableCount.value = { ...stableCount.value, [id]: count };

          const now = Date.now();
          const isManual = manualTriggerSV.value > 0;
          
          if (isManual || (count >= THRESHOLD && (now - lastSentAt.value) > SEND_COOLDOWN)) {
            if (isManual) {
              manualTriggerSV.value = 0; // reset
            }
            lastSentAt.value = now;
            stableCount.value = { ...stableCount.value, [id]: 0 };

            // ── Sub-task 2c: Real frame capture (320x320 for VLM context) ─
            const fullFrameBytes = resize(frame, {
              scale: { width: 320, height: 320 },
              pixelFormat: 'rgb',
              dataType: 'uint8',
            });

            // Bridge bytes to JS thread for btoa encoding
            runOnJS(onStableDetection)(fullFrameBytes, bbox);

            // Only send the first stable detection per cooldown window
            break;
          }
        }
      } catch {
        // Silently ignore per-frame errors — never crash the worklet
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
    <Camera
      ref={(ref) => {
        if (ref !== cameraRef) setCameraRef(ref);
      }}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={true}
      frameProcessor={frameProcessor}
      torch={torchEnabled ? 'on' : 'off'}
      enableFpsGraph={__DEV__}
    />
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
});
