import occtImport from "occt-import-js";
import type { StepMeshData, Vec3Tuple } from "../types";

let occtPromise: ReturnType<typeof occtImport> | undefined;

const getOcct = () => {
  occtPromise ??= occtImport({
    locateFile: (path) => (path.endsWith(".wasm") ? "/occt-import-js.wasm" : path),
  });
  return occtPromise;
};

export const parseStepFile = async (file: File) => {
  const occt = await getOcct();
  const buffer = new Uint8Array(await file.arrayBuffer());
  return occt.ReadStepFile(buffer, { linearUnit: "meter" });
};

export const loadStepMeshes = async (file: File) => {
  const result = await parseStepFile(file);

  if (!result.success) {
    throw new Error(result.error || "OpenCascade could not read this STEP file.");
  }

  if (!result.meshes || result.meshes.length === 0) {
    throw new Error("No renderable meshes were found in this STEP file.");
  }

  const meshes = result.meshes
    .map((mesh, index): StepMeshData | null => {
      const positions = mesh.attributes?.position?.array;
      const indices = mesh.index?.array;
      if (!positions || !indices || positions.length === 0 || indices.length === 0) return null;

      return {
        id: `${file.name}-${index}`,
        name: mesh.name || `${file.name}_${index + 1}`,
        positions,
        normals: mesh.attributes?.normal?.array,
        indices,
        color: mesh.color,
        brepFaces: mesh.brep_faces,
      };
    })
    .filter((mesh): mesh is StepMeshData => Boolean(mesh));

  if (meshes.length === 0) {
    throw new Error("The STEP file loaded, but it did not contain triangle mesh data.");
  }

  return centerMeshes(meshes);
};

const centerMeshes = (meshes: StepMeshData[]) => {
  const min: Vec3Tuple = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vec3Tuple = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (const mesh of meshes) {
    for (let index = 0; index < mesh.positions.length; index += 3) {
      min[0] = Math.min(min[0], mesh.positions[index]);
      min[1] = Math.min(min[1], mesh.positions[index + 1]);
      min[2] = Math.min(min[2], mesh.positions[index + 2]);
      max[0] = Math.max(max[0], mesh.positions[index]);
      max[1] = Math.max(max[1], mesh.positions[index + 1]);
      max[2] = Math.max(max[2], mesh.positions[index + 2]);
    }
  }

  const rawDimensions: Vec3Tuple = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center: Vec3Tuple = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const dimensions = rawDimensions.map((value) => Math.max(0.000001, value)) as Vec3Tuple;

  return {
    dimensions,
    meshes: meshes.map((mesh) => ({
      ...mesh,
      positions: mesh.positions.map((value, index) => {
        const axis = index % 3;
        return value - center[axis];
      }),
    })),
  };
};
