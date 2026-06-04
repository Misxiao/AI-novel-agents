import { create } from "zustand";

import type { TaskStatus } from "@/types";

interface AppState {
  selectedNovelId: string;
  sidebarOpen: boolean;
  taskStatusFilter: TaskStatus | "all";
  draftBodies: Record<string, string>;
  toastMessage: string;
  setSelectedNovelId: (novelId: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setTaskStatusFilter: (status: TaskStatus | "all") => void;
  setDraftBody: (novelId: string, body: string) => void;
  setToastMessage: (message: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedNovelId: "",
  sidebarOpen: false,
  taskStatusFilter: "all",
  draftBodies: {},
  toastMessage: "",
  setSelectedNovelId: (novelId) => set({ selectedNovelId: novelId }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setTaskStatusFilter: (taskStatusFilter) => set({ taskStatusFilter }),
  setDraftBody: (novelId, body) =>
    set((state) => ({
      draftBodies: {
        ...state.draftBodies,
        [novelId]: body,
      },
    })),
  setToastMessage: (toastMessage) => set({ toastMessage }),
}));
