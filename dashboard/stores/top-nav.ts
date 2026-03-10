import { create } from "zustand";
import { Organization, Project } from "@/types";

interface TopNavState {
  title: string;
  organization: Organization | null;
  project: Project | null;
  organizations: Organization[];
  projects: Project[];
  hasSidebar: boolean;
  setTitle: (title: string) => void;
  setOrganization: (organization: Organization | null) => void;
  setProject: (project: Project | null) => void;
  setOrganizations: (organizations: Organization[]) => void;
  setProjects: (projects: Project[]) => void;
  setHasSidebar: (hasSidebar: boolean) => void;
  // Unified initialization function
  initialize: (config: {
    title?: string;
    organization?: Organization | null;
    project?: Project | null;
    organizations?: Organization[];
    projects?: Project[];
    hasSidebar?: boolean;
  }) => void;
  // Reset to default state
  reset: () => void;
}

const defaultState = {
  title: "",
  organization: null,
  project: null,
  organizations: [],
  projects: [],
  hasSidebar: false,
};

export const useTopNavStore = create<TopNavState>((set) => ({
  ...defaultState,
  setTitle: (title) => set({ title }),
  setOrganization: (organization) => set({ organization }),
  setProject: (project) => set({ project }),
  setOrganizations: (organizations) => set({ organizations }),
  setProjects: (projects) => set({ projects }),
  setHasSidebar: (hasSidebar) => set({ hasSidebar }),
  initialize: (config) => {
    set((state) => ({
      ...state,
      ...(config.title !== undefined && { title: config.title }),
      ...(config.organization !== undefined && { organization: config.organization }),
      ...(config.project !== undefined && { project: config.project }),
      ...(config.organizations !== undefined && { organizations: config.organizations }),
      ...(config.projects !== undefined && { projects: config.projects }),
      ...(config.hasSidebar !== undefined && { hasSidebar: config.hasSidebar }),
    }));
  },
  reset: () => set(defaultState),
}));
