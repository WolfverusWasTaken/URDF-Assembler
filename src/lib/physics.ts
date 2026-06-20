import { Vector3 } from "three";
import type {
  InertiaTensor,
  PhysicalBodyConfig,
  PhysicalBodyResult,
  PhysicalMaterialName,
  PhysicalSummary,
  StepMeshData,
  Vec3Tuple,
} from "../types";
import { estimateBoxInertia, ensurePositive } from "./math";

export const materialPresets: Array<{ name: PhysicalMaterialName; density: number }> = [
  { name: "PLA", density: 1240 },
  { name: "ABS", density: 1050 },
  { name: "Aluminum", density: 2700 },
  { name: "Steel", density: 7850 },
  { name: "Carbon Fiber", density: 1600 },
];

const EPS = 1e-9;

const zeroInertia = (): InertiaTensor => ({ ixx: 0, ixy: 0, ixz: 0, iyy: 0, iyz: 0, izz: 0 });
const toTuple = (value: Vector3): Vec3Tuple => [value.x, value.y, value.z];

const meshBounds = (meshes: StepMeshData[]) => {
  const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

  for (const mesh of meshes) {
    for (let index = 0; index < mesh.positions.length; index += 3) {
      min.x = Math.min(min.x, mesh.positions[index]);
      min.y = Math.min(min.y, mesh.positions[index + 1]);
      min.z = Math.min(min.z, mesh.positions[index + 2]);
      max.x = Math.max(max.x, mesh.positions[index]);
      max.y = Math.max(max.y, mesh.positions[index + 1]);
      max.z = Math.max(max.z, mesh.positions[index + 2]);
    }
  }

  const dimensions = max.clone().sub(min);
  return {
    min,
    max,
    center: min.clone().add(max).multiplyScalar(0.5),
    dimensions: [Math.max(0.001, dimensions.x), Math.max(0.001, dimensions.y), Math.max(0.001, dimensions.z)] as Vec3Tuple,
  };
};

const vertexAt = (mesh: StepMeshData, vertexIndex: number) => {
  const offset = vertexIndex * 3;
  return new Vector3(mesh.positions[offset], mesh.positions[offset + 1], mesh.positions[offset + 2]);
};

const estimateMeshVolumeAndCom = (meshes: StepMeshData[], fallbackDimensions: Vec3Tuple) => {
  const bounds = meshBounds(meshes);
  const reference = bounds.center;
  let signedVolume = 0;
  const weightedCentroid = new Vector3();

  for (const mesh of meshes) {
    for (let index = 0; index < mesh.indices.length; index += 3) {
      const a = vertexAt(mesh, mesh.indices[index]).sub(reference);
      const b = vertexAt(mesh, mesh.indices[index + 1]).sub(reference);
      const c = vertexAt(mesh, mesh.indices[index + 2]).sub(reference);
      const tetraVolume = a.dot(b.clone().cross(c)) / 6;
      const tetraCentroid = a.clone().add(b).add(c).multiplyScalar(0.25);
      signedVolume += tetraVolume;
      weightedCentroid.add(tetraCentroid.multiplyScalar(tetraVolume));
    }
  }

  const volume = Math.abs(signedVolume);
  if (volume > EPS) {
    weightedCentroid.divideScalar(signedVolume);
    if (signedVolume < 0) {
      weightedCentroid.multiplyScalar(-1);
    }
    weightedCentroid.add(reference);
    return { volume, centerOfMass: toTuple(weightedCentroid) };
  }

  const dimensions = fallbackDimensions.map((value) => Math.max(0.001, value)) as Vec3Tuple;
  return {
    volume: Math.max(EPS, dimensions[0] * dimensions[1] * dimensions[2] * 0.62),
    centerOfMass: [0, 0, 0] as Vec3Tuple,
  };
};

const bodyInertiaAboutCom = (mass: number, dimensions: Vec3Tuple): InertiaTensor => {
  const safeMass = Math.max(0.001, ensurePositive(mass, 0.001));
  const [x, y, z] = dimensions.map((value) => Math.max(0.001, ensurePositive(value, 0.001))) as Vec3Tuple;
  const floor = Math.max(1e-9, safeMass * 1e-8);
  return {
    ixx: Math.max(floor, (safeMass / 12) * (y * y + z * z)),
    ixy: 0,
    ixz: 0,
    iyy: Math.max(floor, (safeMass / 12) * (x * x + z * z)),
    iyz: 0,
    izz: Math.max(floor, (safeMass / 12) * (x * x + y * y)),
  };
};

const addMatrices = (left: InertiaTensor, right: InertiaTensor): InertiaTensor => ({
  ixx: left.ixx + right.ixx,
  ixy: left.ixy + right.ixy,
  ixz: left.ixz + right.ixz,
  iyy: left.iyy + right.iyy,
  iyz: left.iyz + right.iyz,
  izz: left.izz + right.izz,
});

const shiftInertia = (inertia: InertiaTensor, mass: number, delta: Vec3Tuple): InertiaTensor => {
  const [dx, dy, dz] = delta;
  const distanceSq = dx * dx + dy * dy + dz * dz;
  return {
    ixx: inertia.ixx + mass * (distanceSq - dx * dx),
    ixy: inertia.ixy - mass * dx * dy,
    ixz: inertia.ixz - mass * dx * dz,
    iyy: inertia.iyy + mass * (distanceSq - dy * dy),
    iyz: inertia.iyz - mass * dy * dz,
    izz: inertia.izz + mass * (distanceSq - dz * dz),
  };
};

const determinant = (inertia: InertiaTensor) =>
  inertia.ixx * inertia.iyy * inertia.izz + 2 * inertia.ixy * inertia.ixz * inertia.iyz - inertia.ixx * inertia.iyz * inertia.iyz - inertia.iyy * inertia.ixz * inertia.ixz - inertia.izz * inertia.ixy * inertia.ixy;

const eigenvaluesSymmetric3x3 = (inertia: InertiaTensor) => {
  const a = inertia.ixx;
  const b = inertia.iyy;
  const c = inertia.izz;
  const d = inertia.ixy;
  const e = inertia.ixz;
  const f = inertia.iyz;
  const p1 = d * d + e * e + f * f;

  if (p1 < EPS) return [a, b, c];

  const trace = (a + b + c) / 3;
  const a11 = a - trace;
  const a22 = b - trace;
  const a33 = c - trace;
  const p2 = a11 * a11 + a22 * a22 + a33 * a33 + 2 * p1;
  const p = Math.sqrt(p2 / 6);
  const invP = 1 / p;
  const b11 = a11 * invP;
  const b12 = d * invP;
  const b13 = e * invP;
  const b22 = a22 * invP;
  const b23 = f * invP;
  const b33 = a33 * invP;
  const detB =
    b11 * b22 * b33 +
    2 * b12 * b13 * b23 -
    b11 * b23 * b23 -
    b22 * b13 * b13 -
    b33 * b12 * b12;
  const r = Math.max(-1, Math.min(1, detB / 2));
  const phi = Math.acos(r) / 3;
  const twoP = 2 * p;
  const eig1 = trace + twoP * Math.cos(phi);
  const eig3 = trace + twoP * Math.cos(phi + (2 * Math.PI) / 3);
  const eig2 = 3 * trace - eig1 - eig3;
  return [eig1, eig2, eig3];
};

const isInertiaPhysicallyConsistent = (inertia: InertiaTensor, mass: number) => {
  if (![inertia.ixx, inertia.ixy, inertia.ixz, inertia.iyy, inertia.iyz, inertia.izz, mass].every(Number.isFinite)) {
    return false;
  }
  if (mass <= EPS) return false;
  const eigenvalues = eigenvaluesSymmetric3x3(inertia).sort((left, right) => left - right);
  const scale = Math.max(
    Math.abs(inertia.ixx),
    Math.abs(inertia.iyy),
    Math.abs(inertia.izz),
    Math.abs(inertia.ixy),
    Math.abs(inertia.ixz),
    Math.abs(inertia.iyz),
    1e-12,
  );
  const tolerance = Math.max(EPS, scale * 1e-8);
  if (eigenvalues[0] <= -tolerance) return false;
  if (eigenvalues[0] > eigenvalues[1] + eigenvalues[2] + tolerance) return false;
  if (eigenvalues[1] > eigenvalues[0] + eigenvalues[2] + tolerance) return false;
  if (eigenvalues[2] > eigenvalues[0] + eigenvalues[1] + tolerance) return false;
  const det = determinant(inertia);
  return det >= -tolerance * scale * scale;
};

export const createDefaultPhysicalBodies = (meshes: StepMeshData[], existing: PhysicalBodyConfig[] = []) =>
  meshes.map((mesh, index) => {
    const prior = existing.find((body) => body.meshId === mesh.id);
    return {
      id: prior?.id ?? crypto.randomUUID(),
      meshId: mesh.id,
      meshIds: prior?.meshIds ?? [mesh.id],
      name: prior?.name ?? mesh.name ?? `subbody_${index + 1}`,
      enabled: prior?.enabled ?? true,
      materialName: prior?.materialName ?? "Aluminum",
      density: prior?.density ?? 2700,
      massMode: prior?.massMode ?? "density",
      manualMass: prior?.manualMass ?? null,
    } satisfies PhysicalBodyConfig;
  });

export const resolvePhysicalBodies = (meshes: StepMeshData[], existing?: PhysicalBodyConfig[]) => {
  if (existing === undefined) return createDefaultPhysicalBodies(meshes);
  return existing;
};

export const computePhysicalBody = (meshes: StepMeshData[], config: PhysicalBodyConfig): PhysicalBodyResult => {
  const directMesh = meshes.find((entry) => entry.id === config.meshId);
  const bodyMeshes = config.meshIds?.length ? meshIdsToMeshes(meshes, config.meshIds) : directMesh ? [directMesh] : [];
  const bounds = meshBounds(bodyMeshes);
  const meshEstimate = estimateMeshVolumeAndCom(bodyMeshes, bounds.dimensions);
  const mass = config.enabled
    ? config.massMode === "manual"
      ? Math.max(0.001, ensurePositive(config.manualMass ?? 0, meshEstimate.volume * config.density))
      : Math.max(0.001, meshEstimate.volume * Math.max(1, ensurePositive(config.density, 2700)))
    : 0;
  const inertia = config.enabled ? bodyInertiaAboutCom(mass, bounds.dimensions) : zeroInertia();

  return {
    ...config,
    volume: meshEstimate.volume,
    mass,
    centerOfMass: meshEstimate.centerOfMass,
    inertia,
    dimensions: bounds.dimensions,
    valid: mass > EPS && Number.isFinite(mass),
    warnings: config.enabled ? [] : ["disabled"],
  };
};

const meshIdsToMeshes = (meshes: StepMeshData[], meshIds: string[]) =>
  meshIds
    .map((meshId) => meshes.find((entry) => entry.id === meshId))
    .filter((mesh): mesh is StepMeshData => Boolean(mesh));

export const computeLinkPhysicalSummary = (meshes: StepMeshData[], bodies: PhysicalBodyConfig[]): PhysicalSummary => {
  const computedBodies = bodies
    .map((body) => {
      const bodyMeshes = body.meshIds?.length
        ? meshIdsToMeshes(meshes, body.meshIds)
        : meshes.filter((entry) => entry.id === body.meshId);
      if (bodyMeshes.length === 0) {
        return {
          ...body,
          volume: 0,
          mass: 0,
          centerOfMass: [0, 0, 0] as Vec3Tuple,
          inertia: zeroInertia(),
          dimensions: [0.001, 0.001, 0.001] as Vec3Tuple,
          valid: false,
          warnings: ["missing mesh"],
        } satisfies PhysicalBodyResult;
      }
      return computePhysicalBody(bodyMeshes, body);
    })
    .filter((body) => body.enabled);

  const totalMass = computedBodies.reduce((sum, body) => sum + body.mass, 0);
  const totalVolume = computedBodies.reduce((sum, body) => sum + body.volume, 0);
  const centerOfMass =
    totalMass > EPS
      ? (computedBodies
          .reduce(
            (acc, body) => {
              acc.x += body.centerOfMass[0] * body.mass;
              acc.y += body.centerOfMass[1] * body.mass;
              acc.z += body.centerOfMass[2] * body.mass;
              return acc;
            },
            new Vector3(),
          )
          .divideScalar(totalMass)
          .toArray() as Vec3Tuple)
      : ([0, 0, 0] as Vec3Tuple);

  let inertia = zeroInertia();
  for (const body of computedBodies) {
    const delta: Vec3Tuple = [
      body.centerOfMass[0] - centerOfMass[0],
      body.centerOfMass[1] - centerOfMass[1],
      body.centerOfMass[2] - centerOfMass[2],
    ];
    inertia = addMatrices(inertia, shiftInertia(body.inertia, body.mass, delta));
  }

  const errors: string[] = [];
  if (computedBodies.length === 0) errors.push("No enabled sub-bodies are selected.");
  if (totalMass <= EPS) errors.push("Mass must be greater than zero.");
  if (!isInertiaPhysicallyConsistent(inertia, totalMass)) {
    errors.push("Inertia tensor failed the positive-definite / triangle-inequality check.");
  }

  return {
    totalMass,
    totalVolume,
    centerOfMass,
    inertia,
    bodies: computedBodies,
    valid: errors.length === 0,
    errors,
  };
};

export const validatePhysicalSummary = (summary: PhysicalSummary) => ({
  valid: summary.valid,
  errors: summary.errors,
  badge: summary.valid ? "Ready" : "Check values",
});
