import { create } from 'zustand';
import type { Hazard, SceneHazard, SpatialTarget, RiskLevel, ActionStep } from '../src/types';
import { BACKEND_URL } from '../src/config';
import { useARTrackingStore } from './arTrackingStore';
import * as Speech from 'expo-speech';

export type WorkflowState =
  | 'READY'
  | 'SCANNING'
  | 'IDENTIFIED'
  | 'MODE_SELECTION'
  | 'EXPLORE_LABELS'
  | 'VOICE_ACTIVE'
  | 'VOICE_SPEAKING'
  | 'GUIDE_MODE'
  | 'COMPLETED';

export type FacingMode = 'back' | 'front';
export type ActiveModeType = 'troubleshoot' | 'guide' | 'explain' | null;

export interface ComponentInfo {
  id: string;
  label: string;
  description: string;
  status: string;
  statusType: 'success' | 'warning' | 'error';
  box_2d: [number, number, number, number];
}

export interface GuideStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  componentId: string;
}

export const MOCK_COMPONENTS: ComponentInfo[] = [
  {
    id: 'motor_body',
    label: 'Motor Body',
    description: 'Protects internal rotor and stator. Dissipates heat through cooling ribs.',
    status: 'Operational',
    statusType: 'success',
    box_2d: [0.38, 0.32, 0.85, 0.74],
  },
  {
    id: 'cooling_fan',
    label: 'Cooling Fan',
    description: 'Helps in heat dissipation and keeps the motor cool during operation. Check for dust buildup or damage.',
    status: 'Clean',
    statusType: 'success',
    box_2d: [0.65, 0.25, 0.94, 0.58],
  },
  {
    id: 'terminal_box',
    label: 'Terminal Box',
    description: 'Houses electrical connections and wiring. Ensure the cover is secure and there are no loose or damaged wires.',
    status: 'Looks Good',
    statusType: 'success',
    box_2d: [0.15, 0.22, 0.48, 0.46],
  },
  {
    id: 'shaft',
    label: 'Shaft',
    description: 'Transmits mechanical power to connected equipment. Ensure it rotates smoothly without excess vibration.',
    status: 'Aligned',
    statusType: 'success',
    box_2d: [0.05, 0.62, 0.22, 0.78],
  },
];

export const MOCK_GUIDE_STEPS: GuideStep[] = [
  {
    id: 'step_1',
    stepNumber: 1,
    title: 'De-energize Motor Panel',
    description: 'Disconnect power source from the main switchboard and apply Lockout/Tagout (LOTO) procedures.',
    componentId: 'terminal_box',
  },
  {
    id: 'step_2',
    stepNumber: 2,
    title: 'Clean the Cooling Fan',
    description: 'Remove dust or debris from the fan cover and blades for proper airflow and cooling.',
    componentId: 'cooling_fan',
  },
  {
    id: 'step_3',
    stepNumber: 3,
    title: 'Inspect Terminal Box Wiring',
    description: 'Open the cover and inspect wiring for any loose connections or thermal damage.',
    componentId: 'terminal_box',
  },
  {
    id: 'step_4',
    stepNumber: 4,
    title: 'Perform Rotation Test',
    description: 'Turn the shaft manually to verify it moves freely without resistance or grinding noise.',
    componentId: 'shaft',
  },
];

export interface WorkflowStore {
  workflowState: WorkflowState;
  manualScanTick: number;

  // New state machine values
  scanningProgress: number;
  activeMode: ActiveModeType;
  deviceName: string;
  deviceConfidence: number;
  deviceDescription: string;
  lastCapturedImageB64: string | null;
  
  components: ComponentInfo[];
  activeComponentIndex: number;

  likelyIssue: string;
  relatedParts: string[];
  troubleshootSummary: string;
  troubleshootCauses: string[];
  troubleshootActions: string[];

  guideSteps: GuideStep[];
  activeStepIndex: number;

  // Voice Assistant variables
  voiceInputText: string;
  voiceResponseText: string;
  voiceSolutions: string[];

  // Legacy compat fields
  allSceneHazards: SceneHazard[];
  selectedHazardId: string | null;
  detectedHazards: Hazard[];
  selectedHazard: Hazard | null;
  completedStepIds: Set<string>;
  activeStepId: string | null;
  guidance: any | null;
  spatialTargets: SpatialTarget[];
  generalSolutions: string[];

  // Camera
  cameraRef: any | null;
  facing: FacingMode;
  torchEnabled: boolean;
  isLandscape: boolean;

  // Sheet snap tracking
  sheetSnapIndex: number;

  // Actions
  setCameraRef: (ref: any | null) => void;
  triggerManualScan: () => void;
  startScanningSim: () => void;
  runRealScan: () => Promise<void>;
  setScanningProgress: (prog: number) => void;
  setWorkflowState: (state: WorkflowState) => void;
  confirmDevice: (confirmed: boolean) => void;
  selectMode: (mode: ActiveModeType) => void;
  setActiveComponentIndex: (index: number) => void;
  setActiveStepIndex: (index: number) => void;
  setVoiceActiveState: (active: boolean) => void;
  setVoiceSpeakingState: (text: string, solutions?: string[]) => void;

  nextComponent: () => void;
  prevComponent: () => void;
  nextStep: () => void;
  prevStep: () => void;

  // Backward compatibility actions
  startAnalysis: () => void;
  onHazardsDiscovered: (sceneHazards: SceneHazard[], defaultSelectedId?: string | null) => void;
  selectHazardById: (id: string) => void;
  setSpatialData: (guidance: any, spatialTargets: SpatialTarget[], generalSolutions?: string[]) => void;
  focusHazard: (hazard: Hazard | null) => void;
  openSheet: () => void;

  reset: () => void;
  toggleFacing: () => void;
  toggleTorch: () => void;
  setLandscape: (v: boolean) => void;
  setSheetSnapIndex: (i: number) => void;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflowState: 'READY',
  manualScanTick: 0,
  scanningProgress: 0,
  activeMode: null,
  deviceName: 'AC Induction Motor',
  deviceConfidence: 94,
  deviceDescription: 'An induction motor converts electrical power into mechanical power. Used in pumps, fans, conveyors and more.',
  lastCapturedImageB64: null,
  components: MOCK_COMPONENTS,
  activeComponentIndex: 0,
  likelyIssue: 'Overheating',
  relatedParts: ['cooling_fan', 'motor_body'],
  troubleshootSummary: '',
  troubleshootCauses: [],
  troubleshootActions: [],
  guideSteps: MOCK_GUIDE_STEPS,
  activeStepIndex: 0,

  voiceInputText: 'How can I help you?',
  voiceResponseText: 'The motor is running hot. Possible causes could be overloading, poor ventilation, or a dirty cooling fan.',
  voiceSolutions: [
    'Check the load on the motor',
    'Clean the cooling fan and vents',
    'Ensure proper airflow'
  ],

  // Legacy fields
  allSceneHazards: [],
  selectedHazardId: null,
  detectedHazards: [],
  selectedHazard: null,
  completedStepIds: new Set(),
  activeStepId: null,
  guidance: null,
  spatialTargets: [],
  generalSolutions: [],
  cameraRef: null,
  facing: 'back',
  torchEnabled: false,
  isLandscape: false,
  sheetSnapIndex: -1,

  setCameraRef: (cameraRef) => set({ cameraRef }),
  triggerManualScan: () => set((state) => ({ manualScanTick: state.manualScanTick + 1 })),

  startScanningSim: () => {
    set({ workflowState: 'SCANNING', scanningProgress: 0 });
    let current = 0;
    const interval = setInterval(() => {
      current += 5;
      if (current >= 100) {
        clearInterval(interval);
        set({ workflowState: 'IDENTIFIED', scanningProgress: 100 });
      } else {
        set({ scanningProgress: current });
      }
    }, 100);
  },

  runRealScan: async () => {
    const { cameraRef } = get();
    if (!cameraRef) {
      alert("Camera is not ready yet!");
      return;
    }
    
    // Clear tracking offset and targets on new scan
    useARTrackingStore.getState().clear();
    set({ workflowState: 'SCANNING', scanningProgress: 0, lastCapturedImageB64: null });
    
    // Simulate premium visual progress ticks
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 8;
      if (progress < 90) {
        set({ scanningProgress: progress });
      }
    }, 100);

    try {
      const photo = await cameraRef.takePhoto({ flash: 'off' });
      const response = await fetch(`file://${photo.path}`);
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const b64 = (reader.result as string).split(',')[1];
        
        try {
          // Step 1: Identify Device
          const identifyRes = await fetch(`${BACKEND_URL}/identify-device`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_b64: b64, device_context: { lighting: 'normal' } })
          });
          
          if (!identifyRes.ok) throw new Error('Identify API request failed');
          const identifyData = await identifyRes.json();
          
          const detectedDevice = identifyData.device || 'Unknown Device';
          const detectedConfidence = Math.round((identifyData.confidence || 0.5) * 100);
          const detectedSummary = identifyData.summary || '';
          
          // Step 2: Analyze Components
          const componentsRes = await fetch(`${BACKEND_URL}/analyze-components`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_b64: b64, device: detectedDevice })
          });
          
          if (componentsRes.ok) {
            const componentsData = await componentsRes.json();
            
            // Map components from backend to ComponentInfo
            if (componentsData.components && componentsData.components.length > 0) {
              const mappedComponents = componentsData.components.map((c: any) => ({
                id: c.id,
                label: c.name || c.label,
                description: c.description || '',
                status: c.status || 'Detected',
                statusType: c.statusType || 'success',
                box_2d: c.box_2d || c.bbox || [0,0,0,0],
              }));
              
              set({ components: mappedComponents });
              
              // Also initialize AR tracking targets for spatial tracking!
              const spatialTargets = componentsData.components.map((c: any) => ({
                id: c.id,
                hazard_ref: 'haz_motor',
                label: c.name || c.label,
                type: c.importance === 1 ? 'primary_hazard' : 'neutral_context',
                marker_type: 'ring',
                step_reference: null,
                depth_hint: 0.5,
                priority: 1,
                risk_level: 'LOW',
                box_2d: c.box_2d || c.bbox || [0,0,0,0],
              }));
              useARTrackingStore.getState().initFromVLM(spatialTargets);
            }
          }
          
          clearInterval(progressInterval);
          set({
            workflowState: 'IDENTIFIED',
            scanningProgress: 100,
            deviceName: detectedDevice,
            deviceConfidence: detectedConfidence,
            deviceDescription: detectedSummary,
            lastCapturedImageB64: b64
          });
          
        } catch (apiError) {
          console.error('[Scan] API failed:', apiError);
          clearInterval(progressInterval);
          set({ workflowState: 'READY', scanningProgress: 0 });
          alert("Identification failed. Please ensure the backend is running and online.");
        }
      };
      reader.readAsDataURL(blob);
      
    } catch (e) {
      console.error('[Scan] Photo capture failed:', e);
      clearInterval(progressInterval);
      set({ workflowState: 'READY', scanningProgress: 0 });
      alert("Failed to capture image.");
    }
  },

  setScanningProgress: (scanningProgress) => set({ scanningProgress }),
  setWorkflowState: (workflowState) => {
    Speech.stop();
    set({ workflowState });
  },

  confirmDevice: (confirmed) => {
    Speech.stop();
    if (confirmed) {
      set({ workflowState: 'MODE_SELECTION' });
    } else {
      const { runRealScan } = get();
      runRealScan();
    }
  },

  selectMode: async (activeMode) => {
    Speech.stop();
    if (activeMode === 'explain') {
      set({ activeMode, workflowState: 'EXPLORE_LABELS', activeComponentIndex: 0 });
    } else if (activeMode === 'guide') {
      const { lastCapturedImageB64, deviceName, components, activeComponentIndex } = get();
      
      set({ activeMode, workflowState: 'SCANNING', scanningProgress: 30 });
      
      try {
        const res = await fetch(`${BACKEND_URL}/mode/guide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_b64: lastCapturedImageB64,
            device: deviceName,
            component_id: components[activeComponentIndex]?.id || null,
            device_context: {}
          })
        });
        
        if (!res.ok) throw new Error('Guide API failed');
        const data = await res.json();
        
        if (data.steps && data.steps.length > 0) {
          const mappedSteps = data.steps.map((step: any, idx: number) => ({
            id: step.id || `step_${idx + 1}`,
            stepNumber: step.stepNumber || (idx + 1),
            title: step.title || '',
            description: step.instruction || step.description || '',
            componentId: step.componentId || step.target || ''
          }));
          set({ guideSteps: mappedSteps });
        }
        
        set({ workflowState: 'GUIDE_MODE', activeStepIndex: 0 });
      } catch (error) {
        console.error('[Guide] API failed:', error);
        alert("Failed to load guided procedure. Using cached/mock steps instead.");
        set({ workflowState: 'GUIDE_MODE', activeStepIndex: 0 });
      }
      
    } else if (activeMode === 'troubleshoot') {
      const { lastCapturedImageB64, deviceName, components, activeComponentIndex, likelyIssue } = get();
      
      set({ activeMode, workflowState: 'SCANNING', scanningProgress: 30 });
      
      try {
        const res = await fetch(`${BACKEND_URL}/mode/troubleshoot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_b64: lastCapturedImageB64,
            device: deviceName,
            component_id: components[activeComponentIndex]?.id || null,
            issue: likelyIssue || 'general troubleshooting',
            device_context: {}
          })
        });
        
        if (!res.ok) throw new Error('Troubleshoot API failed');
        const data = await res.json();
        
        const returnedRelated = data.related_components || data.ar_targets || [];
        const returnedIssue = data.issue || likelyIssue;
        const returnedSummary = data.summary || '';
        const returnedCauses = data.possible_causes || [];
        const returnedActions = data.actions || [];
        
        set({
          likelyIssue: returnedIssue,
          relatedParts: returnedRelated,
          troubleshootSummary: returnedSummary,
          troubleshootCauses: returnedCauses,
          troubleshootActions: returnedActions,
        });
        
        const firstRelatedIdx = components.findIndex(c => returnedRelated.includes(c.id));
        set({
          workflowState: 'EXPLORE_LABELS',
          activeComponentIndex: firstRelatedIdx !== -1 ? firstRelatedIdx : 0
        });
      } catch (error) {
        console.error('[Troubleshoot] API failed:', error);
        alert("Failed to load troubleshooting steps. Using cached/mock components instead.");
        const firstRelatedIdx = components.findIndex(c => ['cooling_fan', 'motor_body'].includes(c.id));
        set({
          likelyIssue: 'Overheating',
          relatedParts: ['cooling_fan', 'motor_body'],
          troubleshootSummary: 'The motor has a suspected overheating issue due to bearing wear or fan blockage.',
          troubleshootCauses: ['Blocked cooling fan shroud', 'Lack of bearing lubrication'],
          troubleshootActions: ['Inspect cooling fan blades', 'Verify bearing lubrication'],
          workflowState: 'EXPLORE_LABELS',
          activeComponentIndex: firstRelatedIdx !== -1 ? firstRelatedIdx : 0
        });
      }
      
    } else {
      set({ activeMode: null, workflowState: 'MODE_SELECTION' });
    }
  },

  setActiveComponentIndex: (activeComponentIndex) => set({ activeComponentIndex }),
  setActiveStepIndex: (activeStepIndex) => set({ activeStepIndex }),

  setVoiceActiveState: (active) => {
    Speech.stop();
    if (active) {
      set({ workflowState: 'VOICE_ACTIVE' });
    } else {
      // Revert to previous active state
      const { activeMode } = get();
      if (activeMode === 'guide') {
        set({ workflowState: 'GUIDE_MODE' });
      } else if (activeMode === 'explain' || activeMode === 'troubleshoot') {
        set({ workflowState: 'EXPLORE_LABELS' });
      } else {
        set({ workflowState: 'MODE_SELECTION' });
      }
    }
  },

  setVoiceSpeakingState: (text, solutions = []) => {
    set({ workflowState: 'VOICE_SPEAKING', voiceResponseText: text, voiceSolutions: solutions });
  },

  nextComponent: () => {
    const { activeComponentIndex, components } = get();
    if (components.length === 0) return;
    const nextIdx = (activeComponentIndex + 1) % components.length;
    set({ activeComponentIndex: nextIdx });
  },

  prevComponent: () => {
    const { activeComponentIndex, components } = get();
    if (components.length === 0) return;
    const prevIdx = (activeComponentIndex - 1 + components.length) % components.length;
    set({ activeComponentIndex: prevIdx });
  },

  nextStep: () => {
    const { activeStepIndex, guideSteps } = get();
    if (activeStepIndex < guideSteps.length - 1) {
      set({ activeStepIndex: activeStepIndex + 1 });
    } else {
      set({ workflowState: 'COMPLETED' });
    }
  },

  prevStep: () => {
    const { activeStepIndex } = get();
    if (activeStepIndex > 0) {
      set({ activeStepIndex: activeStepIndex - 1 });
    }
  },

  // Backward compatibility actions
  startAnalysis: () => {
    set({ workflowState: 'SCANNING', scanningProgress: 0 });
  },

  onHazardsDiscovered: (sceneHazards: SceneHazard[], defaultSelectedId?: string | null) => {
    set({ allSceneHazards: sceneHazards, selectedHazardId: defaultSelectedId ?? null });
  },

  selectHazardById: (id: string) => {
    // No-op for simulated mode
  },

  setSpatialData: (guidance: any, spatialTargets: SpatialTarget[], generalSolutions: string[] = []) => {
    set({ guidance, spatialTargets, generalSolutions });
  },

  focusHazard: (hazard: Hazard | null) => {
    set({ selectedHazard: hazard });
  },

  openSheet: () => {
    set({ sheetSnapIndex: 2 });
  },

  reset: () => {
    Speech.stop();
    useARTrackingStore.getState().clear();
    set({
      workflowState: 'READY',
      scanningProgress: 0,
      activeMode: null,
      activeComponentIndex: 0,
      activeStepIndex: 0,
      lastCapturedImageB64: null,
      allSceneHazards: [],
      selectedHazardId: null,
      detectedHazards: [],
      selectedHazard: null,
      completedStepIds: new Set(),
      activeStepId: null,
      guidance: null,
      spatialTargets: [],
      generalSolutions: [],
      troubleshootSummary: '',
      troubleshootCauses: [],
      troubleshootActions: [],
      sheetSnapIndex: -1,
    });
  },

  toggleFacing: () =>
    set((s) => ({ facing: s.facing === 'back' ? 'front' : 'back' })),

  toggleTorch: () =>
    set((s) => ({ torchEnabled: !s.torchEnabled })),

  setLandscape: (v) => set({ isLandscape: v }),

  setSheetSnapIndex: (i) => set({ sheetSnapIndex: i }),
}));

