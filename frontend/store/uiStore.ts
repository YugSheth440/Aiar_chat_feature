import { create } from 'zustand';

type ThemeMode = 'operational' | 'critical';
type SheetPosition = 'collapsed' | 'half' | 'full';

interface UiState {
  theme: ThemeMode;
  sheetPosition: SheetPosition;
  activeHazardId: string | null;
  isLandscape: boolean;
  setTheme: (theme: ThemeMode) => void;
  setSheetPosition: (pos: SheetPosition) => void;
  setActiveHazardId: (id: string | null) => void;
  setIsLandscape: (isLandscape: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'operational',
  sheetPosition: 'collapsed',
  activeHazardId: null,
  isLandscape: false,
  setTheme: (theme) => set({ theme }),
  setSheetPosition: (sheetPosition) => set({ sheetPosition }),
  setActiveHazardId: (activeHazardId) => set({ activeHazardId }),
  setIsLandscape: (isLandscape) => set({ isLandscape }),
}));
