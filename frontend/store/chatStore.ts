import { create } from 'zustand';
import { db } from '../db/client';
import { chatHistory } from '../db/schema';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  focusTargetId?: string | null; // AR marker the assistant's answer refers to
}

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  isOpen: boolean;  // whether the AskAI panel is visible

  addUserMessage: (content: string) => ChatMessage;
  addAssistantMessage: (content: string, focusTargetId?: string | null) => void;
  setTyping: (v: boolean) => void;
  open: () => void;
  close: () => void;
  clear: () => void;
  clearHistory: () => Promise<void>; // clear SQLite database when session is over
  loadHistory: () => Promise<void>; // load chat history from SQLite

  // Returns last N message pairs for conversation history (sent to backend)
  getHistory: (maxTurns?: number) => { role: 'user' | 'assistant'; content: string }[];
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isTyping: false,
  isOpen: false,

  addUserMessage: (content) => {
    const msg: ChatMessage = {
      id: `chat_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    // Save to local SQLite database asynchronously
    db.insert(chatHistory)
      .values({
        id: msg.id,
        sessionId: 'default',
        role: 'user',
        content: msg.content,
        timestamp: msg.timestamp,
      })
      .then(() => {})
      .catch((err) => console.error('[chatStore] Failed to persist user message:', err));

    set((s) => ({ messages: [...s.messages, msg] }));
    return msg;
  },

  addAssistantMessage: (content, focusTargetId) => {
    const msg: ChatMessage = {
      id: `chat_${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      focusTargetId,
    };

    // Save to local SQLite database asynchronously
    db.insert(chatHistory)
      .values({
        id: msg.id,
        sessionId: 'default',
        role: 'assistant',
        content: msg.content,
        timestamp: msg.timestamp,
        focusTargetId: msg.focusTargetId,
      })
      .then(() => {})
      .catch((err) => console.error('[chatStore] Failed to persist assistant message:', err));

    set((s) => ({ messages: [...s.messages, msg], isTyping: false }));
  },

  setTyping: (isTyping) => set({ isTyping }),
  open:  () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  
  clear: () => {
    // Delete history from SQLite when chat is manually cleared
    db.delete(chatHistory)
      .then(() => {})
      .catch((err) => console.error('[chatStore] Failed to clear SQLite chat history:', err));
    set({ messages: [], isTyping: false });
  },

  clearHistory: async () => {
    try {
      await db.delete(chatHistory);
      set({ messages: [], isTyping: false });
      console.log('[chatStore] SQLite chat history cleared (session ended).');
    } catch (err) {
      console.error('[chatStore] Failed to clear history database:', err);
    }
  },

  loadHistory: async () => {
    try {
      const rows = await db.select().from(chatHistory).orderBy(chatHistory.timestamp);
      const messages: ChatMessage[] = rows.map((r) => ({
        id: r.id,
        role: r.role as 'user' | 'assistant',
        content: r.content,
        timestamp: r.timestamp,
        focusTargetId: r.focusTargetId,
      }));
      set({ messages });
    } catch (err) {
      console.error('[chatStore] Failed to load chat history:', err);
    }
  },

  getHistory: (maxTurns = 3) => {
    const { messages } = get();
    return messages
      .slice(-(maxTurns * 2))
      .map((m) => ({ role: m.role, content: m.content }));
  },
}));
