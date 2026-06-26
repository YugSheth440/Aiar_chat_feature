import { create } from 'zustand';

interface SessionState {
  sessionId: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  setSessionId: (id: string | null) => void;
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  connectionStatus: 'disconnected',
  setSessionId: (sessionId) => set({ sessionId }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));
