import { Vector3 } from "three";
import type { InertiaTensor, StepMeshData, Vec3Tuple } from "../types";

export const toVector = (value: Vec3Tuple) => new Vector3(value[0], value[1], value[2]);

export const toTuple = (value: Vector3): Vec3Tuple => [value.x, value.y, value.z];

export const normalizeTuple = (value: Vec3Tuple): Vec3Tuple => {
  const vector = toVector(value);
  if (vector.lengthSq() < 0.000001) return [1, 0, 0];
  return toTuple(vector.normalize());
};

export const formatNumber = (value: number, digits = 3) => {
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.?0+$/, "");
};

export const tupleToString = (value: Vec3Tuple, digits = 3) =>
  value.map((item) => formatNumber(item, digits)).join(" ");

export const ensurePositive = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

export const estimateBoxInertia = (mass: number, dimensions: Vec3Tuple): InertiaTensor => {
  const safeMass = Math.max(0.001, ensurePositive(mass, 0.001));
  const [x, y, z] = dimensions.map((value) => Math.max(0.001, ensurePositive(value, 0.001))) as Vec3Tuple;
  const floor = Math.max(1e-9, safeMass * 1e-8);
  return {
    ixx: Math.max(floor, (safeMass / 12) * (y * y + z * z)),
    iyy: Math.max(floor, (safeMass / 12) * (x * x + z * z)),
    izz: Math.max(floor, (safeMass / 12) * (x * x + y * y)),
    ixy: 0,
    ixz: 0,
    iyz: 0,
  };
};

const vertexAt = (mesh: StepMeshData, vertexIndex: number) => {
  const offset = vertexIndex * 3;
  return new Vector3(mesh.positions[offset], mesh.positions[offset + 1], mesh.positions[offset + 2]);
};

const meshBounds = (meshes: StepMeshData[]) => {
  const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

  for (const mesh of meshes) {
    for (let index = 0; index < mesh.positions.length; index += 3) {
      min.min(new Vector3(mesh.positions[index], mesh.positions[index + 1], mesh.positions[index + 2]));
      max.max(new Vector3(mesh.positions[index], mesh.positions[index + 1], mesh.positions[index + 2]));
    }
  }

  const dimensions = max.clone().sub(min);
  return {
    min,
    max,
    center: min.clone().add(max).multiplyScalar(0.5),
    dimensions: [dimensions.x, dimensions.y, dimensions.z].map((value) => Math.max(0.001, value)) as Vec3Tuple,
  };
};

export const estimateMeshVolumeAndCom = (meshes: StepMeshData[], fallbackDimensions: Vec3Tuple) => {
  let signedVolume = 0;
  const weightedCentroid = new Vector3();

  for (const mesh of meshes) {
    for (let index = 0; index < mesh.indices.length; index += 3) {
      const a = vertexAt(mesh, mesh.indices[index]);
      const b = vertexAt(mesh, mesh.indices[index + 1]);
      const c = vertexAt(mesh, mesh.indices[index + 2]);
      const tetraVolume = a.dot(b.clone().cross(c)) / 6;
      const tetraCentroid = a.clone().add(b).add(c).multiplyScalar(0.25);
      signedVolume += tetraVolume;
      weightedCentroid.add(tetraCentroid.multiplyScalar(tetraVolume));
    }
  }

  const volume = Math.abs(signedVolume);
  if (volume > 1e-9) {
    weightedCentroid.divideScalar(signedVolume);
    return {
      volume,
      centerOfMass: [weightedCentroid.x, weightedCentroid.y, weightedCentroid.z] as Vec3Tuple,
    };
  }

  const dimensions = fallbackDimensions.map((value) => Math.max(0.001, value)) as Vec3Tuple;
  return {
    volume: Math.max(1e-9, dimensions[0] * dimensions[1] * dimensions[2] * 0.62),
    centerOfMass: [0, 0, 0] as Vec3Tuple,
  };
};

export const estimateMassProperties = ({
  meshes,
  dimensions,
  density,
}: {
  meshes?: StepMeshData[];
  dimensions: Vec3Tuple;
  density: number;
}) => {
  const safeDensity = Math.max(1, ensurePositive(density, 2700));
  const bounds = meshes && meshes.length > 0 ? meshBounds(meshes) : undefined;
  const effectiveDimensions = bounds?.dimensions ?? dimensions;
  const meshEstimate =
    meshes && meshes.length > 0
      ? estimateMeshVolumeAndCom(meshes, effectiveDimensions)
      : {
          volume: Math.max(1e-9, effectiveDimensions[0] * effectiveDimensions[1] * effectiveDimensions[2] * 0.62),
          centerOfMass: [0, 0, 0] as Vec3Tuple,
        };
  const mass = Math.max(0.001, meshEstimate.volume * safeDensity);

  return {
    dimensions: effectiveDimensions,
    volume: meshEstimate.volume,
    mass,
    centerOfMass: meshEstimate.centerOfMass,
    inertia: estimateBoxInertia(mass, effectiveDimensions),
  };
};
