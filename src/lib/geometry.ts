import type { JointPoint, RobotLink, StepMeshData, Vec3Tuple } from "../types";
import { computeLinkPhysicalSummary, resolvePhysicalBodies } from "./physics";
import { estimateBoxInertia, normalizeTuple } from "./math";

const palette = ["#00C2CB", "#E5D5C5", "#2C2621", "#71D7DC", "#BCA996", "#7C6F64"];

const axisByIndex: Vec3Tuple[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 1, 0],
];

export const makeLinkFromFile = (file: File, index: number): RobotLink => {
  // STEP mesh parsing is isolated in stepLoader.ts; this fallback creates a fast local preview
  // while OCCT-derived mesh data is converted into renderable Three.js geometry.
  const name = file.name.replace(/\.(step|stp)$/i, "").replace(/[^a-zA-Z0-9_]+/g, "_");
  const scale = Math.max(0.55, Math.min(1.7, file.size / 450000));
  const dimensions: Vec3Tuple = [
    1.25 + ((index % 3) * 0.18 + scale * 0.34),
    0.48 + ((index % 2) * 0.12 + scale * 0.12),
    0.52 + (((index + 1) % 3) * 0.1 + scale * 0.13),
  ];
  const density = 2700;
  const fallbackVolume = dimensions[0] * dimensions[1] * dimensions[2];
  const fallbackMass = Math.max(0.001, fallbackVolume * density);
  const fallbackInertia = estimateBoxInertia(fallbackMass, dimensions);

  return {
    id: crypto.randomUUID(),
    name: name || `link_${index + 1}`,
    fileName: file.name,
    fileSize: file.size,
    color: palette[index % palette.length],
    dimensions,
    volume: fallbackVolume,
    mass: fallbackMass,
    materialName: "Aluminum",
    density,
    centerOfMass: [0, 0, 0],
    inertia: fallbackInertia,
    physicalBodies: undefined,
    meshStatus: "pending",
    orientation: [0, 0, 0],
  };
};

export const syncLinkPhysicalProperties = (link: RobotLink, meshes: StepMeshData[]): RobotLink => {
  const bodies = resolvePhysicalBodies(meshes, link.physicalBodies);
  const summary = computeLinkPhysicalSummary(meshes, bodies);
  return {
    ...link,
    physicalBodies: bodies,
    volume: summary.totalVolume,
    mass: summary.totalMass,
    materialName: bodies.every((body) => body.materialName === bodies[0]?.materialName) ? bodies[0]?.materialName ?? "Composite" : "Composite",
    density: summary.totalVolume > 0 ? summary.totalMass / summary.totalVolume : link.density,
    centerOfMass: summary.centerOfMass,
    inertia: summary.inertia,
    meshes,
  };
};

export const snapToFaceCenter = (dimensions: Vec3Tuple, faceNormal: Vec3Tuple): Vec3Tuple => {
  const normalized = normalizeTuple(faceNormal);
  const dominant = normalized.map((component) => Math.abs(component));
  const axisIndex = dominant.indexOf(Math.max(...dominant));
  const snapped: Vec3Tuple = [0, 0, 0];
  snapped[axisIndex] = (dimensions[axisIndex] / 2) * Math.sign(normalized[axisIndex] || 1);
  return snapped;
};

export const inferJointFromHit = (
  link: RobotLink,
  role: "origin" | "rotation",
  hitPoint: Vec3Tuple,
  faceNormal: Vec3Tuple,
): JointPoint => {
  const normalized = normalizeTuple(faceNormal);
  const dominant = normalized.map((component) => Math.abs(component));
  const largest = dominant.indexOf(Math.max(...dominant));
  const axis = normalizeTuple(axisByIndex[largest] ?? [1, 0, 0]);
  const radius = Math.max(0.06, Math.min(link.dimensions[1], link.dimensions[2]) * 0.22);
  const center: Vec3Tuple = [
    Number(hitPoint[0].toFixed(3)),
    Number(hitPoint[1].toFixed(3)),
    Number(hitPoint[2].toFixed(3)),
  ];
  const faceKind = largest === 0 ? "cylindrical" : largest === 1 ? "hole" : "circular";

  return {
    id: crypto.randomUUID(),
    role,
    center,
    axis,
    normal: normalized,
    radius,
    faceKind,
  };
};
