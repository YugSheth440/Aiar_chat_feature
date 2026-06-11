import { create } from 'zustand';
import type { Hazard } from '../src/types';

export type WorkflowState =
  | 'READY'
  | 'ANALYZING'
  | 'HAZARDS_DISCOVERED'
  | 'HAZARD_FOCUSED'
  | 'SHEET_OPEN';

export type FacingMode = 'back' | 'front';

interface WorkflowStore {
  workflowState: WorkflowState;
  manualScanTick: number;
  detectedHazards: Hazard[];
  selectedHazard: Hazard | null;
  completedStepIds: Set<string>;

  // Camera
  cameraRef: any | null;
  facing: FacingMode;
  torchEnabled: boolean;    // real torch toggle (keepTorchOn)
  isLandscape: boolean;

  // Sheet snap tracking (0=hidden/arrow, 1=peek, 2=full)
  sheetSnapIndex: number;

  // Actions
  setCameraRef: (ref: any | null) => void;
  triggerManualScan: () => void;
  startAnalysis: () => void;
  onHazardsDiscovered: (hazards: Hazard[]) => void;
  focusHazard: (hazard: Hazard) => void;
  openSheet: () => void;
  reset: () => void;
  toggleStep: (id: string) => void;
  toggleFacing: () => void;
  toggleTorch: () => void;
  setLandscape: (v: boolean) => void;
  setSheetSnapIndex: (i: number) => void;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflowState: 'READY',
  manualScanTick: 0,
  detectedHazards: [],
  selectedHazard: null,
  completedStepIds: new Set(),
  cameraRef: null,
  facing: 'back',
  torchEnabled: false,
  isLandscape: false,
  sheetSnapIndex: -1,

  setCameraRef: (cameraRef) => set({ cameraRef }),
  triggerManualScan: () => set((state) => ({ manualScanTick: state.manualScanTick + 1 })),

  // ── Always starts immediately on ONE tap regardless of current state ──
  startAnalysis: () =>
    set({
      workflowState: 'ANALYZING',
      detectedHazards: [],
      selectedHazard: null,
      completedStepIds: new Set(),
      sheetSnapIndex: -1,
    }),

  onHazardsDiscovered: (hazards) =>
    set({ detectedHazards: hazards, workflowState: 'HAZARDS_DISCOVERED' }),

  focusHazard: (hazard) =>
    set({ selectedHazard: hazard, workflowState: 'HAZARD_FOCUSED', sheetSnapIndex: 1 }),

  openSheet: () => set({ workflowState: 'SHEET_OPEN', sheetSnapIndex: 2 }),

  reset: () =>
    set({
      workflowState: 'READY',
      detectedHazards: [],
      selectedHazard: null,
      completedStepIds: new Set(),
      sheetSnapIndex: -1,
    }),

  toggleStep: (id) => {
    const next = new Set(get().completedStepIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ completedStepIds: next });
  },

  toggleFacing: () =>
    set((s) => ({ facing: s.facing === 'back' ? 'front' : 'back' })),

  toggleTorch: () =>
    set((s) => ({ torchEnabled: !s.torchEnabled })),

  setLandscape: (v) => set({ isLandscape: v }),

  setSheetSnapIndex: (i) => set({ sheetSnapIndex: i }),
}));
