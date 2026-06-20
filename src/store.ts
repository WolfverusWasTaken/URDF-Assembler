import { create } from "zustand";
import type { JointPoint, JointType, PageKey, RobotJoint, RobotLink, RobotOptions } from "./types";
import { makeLinkFromFile, updateLinkMassProperties } from "./lib/geometry";
import { buildRobotJoints, defaultOptions } from "./lib/robot";
import { loadStepMeshes } from "./lib/stepLoader";

interface AppState {
  page: PageKey;
  links: RobotLink[];
  joints: RobotJoint[];
  baseLinkId?: string;
  selectedLinkId?: string;
  selectedJointId?: string;
  definitionMode: "origin" | "rotation";
  options: RobotOptions;
  addFiles: (files: File[]) => void;
  setLinkParsing: (id: string) => void;
  setLinkMeshes: (id: string, payload: Awaited<ReturnType<typeof loadStepMeshes>>) => void;
  setLinkMeshError: (id: string, error: string) => void;
  removeLink: (id: string) => void;
  setPage: (page: PageKey) => void;
  setSelectedLink: (id: string) => void;
  setSelectedJoint: (id: string) => void;
  setDefinitionMode: (mode: "origin" | "rotation") => void;
  updateLinkJoint: (linkId: string, joint: JointPoint) => void;
  setLinkChild: (linkId: string, childLinkId?: string) => void;
  setBaseLink: (linkId?: string) => void;
  setLinkOrientation: (linkId: string, orientation: [number, number, number]) => void;
  setLinkMaterial: (linkId: string, materialName: string, density: number) => void;
  updateJoint: (id: string, patch: Partial<RobotJoint>) => void;
  setJointType: (id: string, type: JointType) => void;
  setJointValue: (id: string, value: number) => void;
  toggleOption: (key: keyof RobotOptions) => void;
  rebuildJoints: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  page: "upload",
  links: [],
  joints: [],
  baseLinkId: undefined,
  definitionMode: "origin",
  options: defaultOptions,
  addFiles: (files) =>
    set((state) => {
      const stepFiles = files.filter((file) => /\.(step|stp)$/i.test(file.name));
      const links = [
        ...state.links,
        ...stepFiles.map((file, offset) => ({
          ...makeLinkFromFile(file, state.links.length + offset),
          meshStatus: "parsing" as const,
        })),
      ];

      stepFiles.forEach((file, offset) => {
        const link = links[state.links.length + offset];
        void loadStepMeshes(file)
          .then((payload) => get().setLinkMeshes(link.id, payload))
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Could not parse this STEP file.";
            get().setLinkMeshError(link.id, message);
          });
      });

      return {
        links,
        selectedLinkId: state.selectedLinkId ?? links[0]?.id,
        baseLinkId: state.baseLinkId,
        joints: buildRobotJoints(links, state.joints),
      };
    }),
  setLinkParsing: (id) =>
    set((state) => ({
      links: state.links.map((link) => (link.id === id ? { ...link, meshStatus: "parsing", meshError: undefined } : link)),
    })),
  setLinkMeshes: (id, payload) =>
    set((state) => {
      const links = state.links.map((link) =>
        link.id === id
          ? {
              ...updateLinkMassProperties({ ...link, meshes: payload.meshes }, payload.dimensions),
              meshes: payload.meshes,
              meshStatus: "ready" as const,
              meshError: undefined,
            }
          : link,
      );
      return { links, joints: buildRobotJoints(links, state.joints) };
    }),
  setLinkMeshError: (id, error) =>
    set((state) => ({
      links: state.links.map((link) => (link.id === id ? { ...link, meshStatus: "failed", meshError: error } : link)),
    })),
  removeLink: (id) =>
    set((state) => {
      const links = state.links.filter((link) => link.id !== id);
      return {
        links,
        selectedLinkId: state.selectedLinkId === id ? links[0]?.id : state.selectedLinkId,
        baseLinkId: state.baseLinkId === id ? undefined : state.baseLinkId,
        joints: buildRobotJoints(links, state.joints),
      };
    }),
  setPage: (page) => set({ page }),
  setSelectedLink: (id) => set({ selectedLinkId: id }),
  setSelectedJoint: (id) => set({ selectedJointId: id }),
  setDefinitionMode: (mode) => set({ definitionMode: mode }),
  updateLinkJoint: (linkId, joint) =>
    set((state) => {
      const links = state.links.map((link) =>
        link.id === linkId ? { ...link, [joint.role === "origin" ? "originPoint" : "rotationJoint"]: joint } : link,
      );
      return { links, joints: buildRobotJoints(links, state.joints) };
    }),
  setLinkChild: (linkId, childLinkId) =>
    set((state) => {
      const links = state.links.map((link) => (link.id === linkId ? { ...link, childLinkId } : link));
      return { links, joints: buildRobotJoints(links, state.joints) };
    }),
  setBaseLink: (linkId) => set({ baseLinkId: linkId }),
  setLinkOrientation: (linkId, orientation) =>
    set((state) => {
      const links = state.links.map((link) => (link.id === linkId ? { ...link, orientation } : link));
      return { links, joints: buildRobotJoints(links, state.joints) };
    }),
  setLinkMaterial: (linkId, materialName, density) =>
    set((state) => {
      const links = state.links.map((link) =>
        link.id === linkId
          ? updateLinkMassProperties(
              { ...link, materialName, density: Number.isFinite(density) && density > 0 ? density : link.density },
              link.dimensions,
            )
          : link,
      );
      return { links };
    }),
  updateJoint: (id, patch) =>
    set((state) => ({ joints: state.joints.map((joint) => (joint.id === id ? { ...joint, ...patch } : joint)) })),
  setJointType: (id, type) => get().updateJoint(id, { type }),
  setJointValue: (id, value) => get().updateJoint(id, { value }),
  toggleOption: (key) => set((state) => ({ options: { ...state.options, [key]: !state.options[key] } })),
  rebuildJoints: () => set((state) => ({ joints: buildRobotJoints(state.links, state.joints) })),
}));
