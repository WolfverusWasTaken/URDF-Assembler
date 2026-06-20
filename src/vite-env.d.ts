/// <reference types="vite/client" />

declare module "occt-import-js" {
  interface OcctImportOptions {
    locateFile?: (path: string) => string;
  }

  interface OcctMesh {
    name?: string;
    color?: [number, number, number];
    brep_faces?: Array<{
      first: number;
      last: number;
      color?: [number, number, number] | null;
    }>;
    attributes?: {
      position?: { array: number[] };
      normal?: { array: number[] };
    };
    index?: { array: number[] };
  }

  interface OcctStepResult {
    success: boolean;
    meshes?: OcctMesh[];
    error?: string;
  }

  interface OcctImportApi {
    ReadStepFile(buffer: Uint8Array, params: unknown): OcctStepResult;
  }

  export default function occtImport(options?: OcctImportOptions): Promise<OcctImportApi>;
}
