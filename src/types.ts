export type PageKey = "upload" | "definition" | "assembly" | "export";

export type JointType = "revolute" | "continuous" | "prismatic" | "fixed";

export type Vec3Tuple = [number, number, number];

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
