import { create } from "zustand";
import type { ProjectStatus } from "@duckops/shared-types";
import type { AiStep } from "@/lib/aiStreamParser";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
  /** Parsed steps for assistant messages — populated by the streaming parser */
  steps?: AiStep[];
  files?: string[];
  streaming?: boolean;
}

interface AiSessionState {
  messages: AiMessage[];
  sessionId?: string;
  loading: boolean;
  activeFile?: string | null;
  fileContent: string;
}

interface ProjectStore {
  selectedProjectId: string | null;
  liveStatuses: Record<string, { status: ProjectStatus; message: string }>;
  aiSessions: Record<string, AiSessionState>;

  setSelectedProject: (id: string | null) => void;
  updateLiveStatus: (projectId: string, status: ProjectStatus, message: string) => void;
  getAiSession: (projectId: string) => AiSessionState;
  setAiMessages: (projectId: string, updater: (msgs: AiMessage[]) => AiMessage[]) => void;
  setAiSessionId: (projectId: string, sessionId: string) => void;
  setAiLoading: (projectId: string, loading: boolean) => void;
  setAiActiveFile: (projectId: string, file: string | null, content?: string) => void;
}

const DEFAULT_AI_SESSION = (): AiSessionState => ({
  messages: [],
  sessionId: undefined,
  loading: false,
  activeFile: null,
  fileContent: "",
});

export const useProjectStore = create<ProjectStore>((set, get) => ({
  selectedProjectId: null,
  liveStatuses: {},
  aiSessions: {},

  setSelectedProject: (id) => set({ selectedProjectId: id }),

  updateLiveStatus: (projectId, status, message) =>
    set((state) => ({
      liveStatuses: { ...state.liveStatuses, [projectId]: { status, message } },
    })),

  getAiSession: (projectId) => get().aiSessions[projectId] ?? DEFAULT_AI_SESSION(),

  setAiMessages: (projectId, updater) =>
    set((state) => {
      const session = state.aiSessions[projectId] ?? DEFAULT_AI_SESSION();
      return { aiSessions: { ...state.aiSessions, [projectId]: { ...session, messages: updater(session.messages) } } };
    }),

  setAiSessionId: (projectId, sessionId) =>
    set((state) => {
      const session = state.aiSessions[projectId] ?? DEFAULT_AI_SESSION();
      return { aiSessions: { ...state.aiSessions, [projectId]: { ...session, sessionId } } };
    }),

  setAiLoading: (projectId, loading) =>
    set((state) => {
      const session = state.aiSessions[projectId] ?? DEFAULT_AI_SESSION();
      return { aiSessions: { ...state.aiSessions, [projectId]: { ...session, loading } } };
    }),

  setAiActiveFile: (projectId, file, content) =>
    set((state) => {
      const session = state.aiSessions[projectId] ?? DEFAULT_AI_SESSION();
      return {
        aiSessions: {
          ...state.aiSessions,
          [projectId]: {
            ...session,
            activeFile: file,
            fileContent: content !== undefined ? content : session.fileContent,
          },
        },
      };
    }),
}));
