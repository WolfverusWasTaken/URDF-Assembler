import type { JointPoint, RobotLink, Vec3Tuple } from "../types";
import { estimateMassProperties, normalizeTuple } from "./math";

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
  const massProperties = estimateMassProperties({ dimensions, density });

  return {
    id: crypto.randomUUID(),
    name: name || `link_${index + 1}`,
    fileName: file.name,
    fileSize: file.size,
    color: palette[index % palette.length],
    dimensions: massProperties.dimensions,
    volume: massProperties.volume,
    mass: massProperties.mass,
    materialName: "Aluminum",
    density,
    centerOfMass: massProperties.centerOfMass,
    inertia: massProperties.inertia,
    meshStatus: "pending",
    orientation: [0, 0, 0],
  };
};

export const updateLinkMassProperties = (link: RobotLink, dimensions: Vec3Tuple): RobotLink => {
  const massProperties = estimateMassProperties({ meshes: link.meshes, dimensions, density: link.density });
  return { ...link, ...massProperties };
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
