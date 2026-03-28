import { create } from "zustand";
import type { Project, ProjectStatus } from "@duckops/shared-types";

interface ProjectStore {
  selectedProjectId: string | null;
  liveStatuses: Record<string, { status: ProjectStatus; message: string }>;

  setSelectedProject: (id: string | null) => void;
  updateLiveStatus: (
    projectId: string,
    status: ProjectStatus,
    message: string,
  ) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  selectedProjectId: null,
  liveStatuses: {},

  setSelectedProject: (id) => set({ selectedProjectId: id }),

  updateLiveStatus: (projectId, status, message) =>
    set((state) => ({
      liveStatuses: {
        ...state.liveStatuses,
        [projectId]: { status, message },
      },
    })),
}));
