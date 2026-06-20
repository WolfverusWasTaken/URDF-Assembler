export type PageKey = "upload" | "definition" | "physical" | "assembly" | "export";

export type JointType = "revolute" | "continuous" | "prismatic" | "fixed";

export type Vec3Tuple = [number, number, number];

export type PhysicalMaterialName = "PLA" | "ABS" | "Aluminum" | "Steel" | "Carbon Fiber" | "Custom";
export type MassMode = "density" | "manual";

export interface InertiaTensor {
  ixx: number;
  ixy: number;
  ixz: number;
  iyy: number;
  iyz: number;
  izz: number;
}

export interface StepBrepFace {
  first: number;
  last: number;
  color?: Vec3Tuple | null;
}

export interface StepMeshData {
  id: string;
  name: string;
  positions: number[];
  normals?: number[];
  indices: number[];
  color?: Vec3Tuple;
  brepFaces?: StepBrepFace[];
}

export interface PhysicalBodyConfig {
  id: string;
  meshId: string;
  meshIds?: string[];
  name: string;
  enabled: boolean;
  materialName: PhysicalMaterialName;
  density: number;
  massMode: MassMode;
  manualMass?: number | null;
}

export interface PhysicalBodyResult extends PhysicalBodyConfig {
  volume: number;
  mass: number;
  centerOfMass: Vec3Tuple;
  inertia: InertiaTensor;
  dimensions: Vec3Tuple;
  valid: boolean;
  warnings: string[];
}

export interface PhysicalSummary {
  totalMass: number;
  totalVolume: number;
  centerOfMass: Vec3Tuple;
  inertia: InertiaTensor;
  bodies: PhysicalBodyResult[];
  valid: boolean;
  errors: string[];
}

export interface JointPoint {
  id: string;
  role: "origin" | "rotation";
  center: Vec3Tuple;
  axis: Vec3Tuple;
  normal: Vec3Tuple;
  radius: number;
  faceKind: "cylindrical" | "circular" | "shaft" | "hole";
}

export interface RobotLink {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  color: string;
  dimensions: Vec3Tuple;
  volume: number;
  mass: number;
  materialName: string;
  density: number;
  centerOfMass: Vec3Tuple;
  inertia: InertiaTensor;
  physicalBodies?: PhysicalBodyConfig[];
  meshStatus: "pending" | "parsing" | "ready" | "failed";
  meshError?: string;
  meshes?: StepMeshData[];
  orientation: Vec3Tuple;
  originPoint?: JointPoint;
  rotationJoint?: JointPoint;
  childLinkId?: string;
}

export interface RobotJoint {
  id: string;
  name: string;
  type: JointType;
  parentLinkId: string;
  childLinkId: string;
  axis: Vec3Tuple;
  origin: Vec3Tuple;
  limitLower: number;
  limitUpper: number;
  velocity: number;
  effort: number;
  damping: number;
  friction: number;
  value: number;
}

export interface RobotOptions {
  exploded: boolean;
  wireframe: boolean;
  transparent: boolean;
  frames: boolean;
  workspace: boolean;
  collisions: boolean;
}
