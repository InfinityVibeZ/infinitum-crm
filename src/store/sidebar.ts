import { create } from "zustand";

interface SidebarSection {
  [key: string]: boolean;
}

interface SidebarState {
  expandedSections: SidebarSection;
  toggleSection: (section: string) => void;
  setExclusiveSection: (section: string) => void;
  isCollapsed: boolean;
  toggleCollapsed: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  // All sections collapsed by default
  expandedSections: {},
  toggleSection: (section: string) =>
    set((state) => {
      const isCurrentlyOpen = !!state.expandedSections[section];
      // Accordion mode: Close all other sections and toggle current section
      return {
        expandedSections: isCurrentlyOpen ? {} : { [section]: true },
      };
    }),
  setExclusiveSection: (section: string) =>
    set(() => ({
      expandedSections: { [section]: true },
    })),
  isCollapsed: false,
  toggleCollapsed: () =>
    set((state) => ({ isCollapsed: !state.isCollapsed })),
}));
