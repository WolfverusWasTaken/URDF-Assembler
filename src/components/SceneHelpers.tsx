import { Html, Line } from "@react-three/drei";
import { useMemo } from "react";
import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import type { JointPoint, RobotLink, StepMeshData, Vec3Tuple } from "../types";
import { toVector } from "../lib/math";
import { snapToFaceCenter } from "../lib/geometry";

export const modelIndicatorScale = (dimensions: Vec3Tuple) => {
  const largest = Math.max(...dimensions);
  if (!Number.isFinite(largest) || largest <= 0) return 0.1;
  return Math.max(0.002, Math.min(0.12, largest * 0.08));
};

export function AxisIndicator() {
  return (
    <group position={[-2.7, -1.7, 0]}>
      <Line points={[[0, 0, 0], [0.55, 0, 0]]} color="#ef4444" lineWidth={3} />
      <Line points={[[0, 0, 0], [0, 0.55, 0]]} color="#22c55e" lineWidth={3} />
      <Line points={[[0, 0, 0], [0, 0, 0.55]]} color="#3b82f6" lineWidth={3} />
      <Html position={[0.68, 0, 0]} center className="axis-label">X</Html>
      <Html position={[0, 0.68, 0]} center className="axis-label">Y</Html>
      <Html position={[0, 0, 0.68]} center className="axis-label">Z</Html>
    </group>
  );
}

export function CoordinateFrame({ scale = 0.38 }: { scale?: number }) {
  return (
    <group>
      <Line points={[[0, 0, 0], [scale, 0, 0]]} color="#ef4444" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, scale, 0]]} color="#22c55e" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, 0, scale]]} color="#3b82f6" lineWidth={2} />
    </group>
  );
}

export function AxisArrow({ point, color = "#111827", scale = 0.08 }: { point: JointPoint; color?: string; scale?: number }) {
  const start = toVector(point.center);
  const end = start.clone().add(toVector(point.axis).multiplyScalar(scale * 4.8));
  return (
    <group>
      <Line points={[start, end]} color={color} lineWidth={3} />
      <mesh position={end}>
        <sphereGeometry args={[scale * 0.35, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

export function JointAxisIndicator({
  axis,
  label,
  color = "#ffb703",
  scale = 0.08,
}: {
  axis: Vec3Tuple;
  label: string;
  color?: string;
  scale?: number;
}) {
  const vector = toVector(axis);
  if (vector.lengthSq() < 0.000001) vector.set(1, 0, 0);
  vector.normalize();
  const start = vector.clone().multiplyScalar(-scale * 3.5);
  const end = vector.clone().multiplyScalar(scale * 5.5);

  return (
    <group>
      <Line points={[start, end]} color={color} lineWidth={4} />
      <mesh position={end}>
        <sphereGeometry args={[scale * 0.45, 18, 18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
      </mesh>
      <mesh>
        <torusGeometry args={[scale * 1.4, scale * 0.09, 12, 44]} />
        <meshStandardMaterial color={color} transparent opacity={0.82} />
      </mesh>
      <Html position={[0, scale * 2, 0]} center className="joint-axis-label">
        {label}
      </Html>
    </group>
  );
}

export function JointMarker({ point, scale = 0.08 }: { point: JointPoint; scale?: number }) {
  const color = point.role === "origin" ? "#2C2621" : "#00C2CB";
  return (
    <group position={point.center}>
      <mesh>
        <sphereGeometry args={[Math.max(scale * 0.45, Math.min(scale * 0.9, point.radius * 0.25)), 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.1} />
      </mesh>
      <CoordinateFrame scale={scale * 2.2} />
      <AxisArrow point={point} color={color} scale={scale} />
    </group>
  );
}

export function SnapPreview({ center, normal, scale = 0.08 }: { center: Vec3Tuple; normal: Vec3Tuple; scale?: number }) {
  const end = toVector(center).add(toVector(normal).multiplyScalar(scale * 3.2));

  return (
    <group position={center}>
      <mesh>
        <sphereGeometry args={[scale * 0.58, 24, 24]} />
        <meshStandardMaterial color="#F7F2EB" emissive="#00C2CB" emissiveIntensity={0.7} transparent opacity={0.78} />
      </mesh>
      <Line points={[[0, 0, 0], end.sub(toVector(center))]} color="#ffffff" lineWidth={3} />
    </group>
  );
}

export function LinkMesh({
  link,
  wireframe,
  transparent,
  onPick,
  onSnapHover,
  onSnapOut,
}: {
  link: RobotLink;
  wireframe?: boolean;
  transparent?: boolean;
  onPick?: (point: Vec3Tuple, normal: Vec3Tuple) => void;
  onSnapHover?: (point: Vec3Tuple, normal: Vec3Tuple) => void;
  onSnapOut?: () => void;
}) {
  if (link.meshes && link.meshes.length > 0) {
    return (
      <group>
        {link.meshes.map((mesh) => (
          <StepMeshPrimitive
            key={mesh.id}
            mesh={mesh}
            fallbackColor={link.color}
            wireframe={wireframe}
            transparent={transparent}
            onPick={onPick}
            onSnapHover={onSnapHover}
            onSnapOut={onSnapOut}
          />
        ))}
      </group>
    );
  }

  return (
    <group>
      <mesh
        castShadow
        receiveShadow
        onPointerDown={(event) => {
          event.stopPropagation();
          if (!onPick) return;
          const normal = event.face?.normal.clone().normalize() ?? new Vector3(1, 0, 0);
          const normalTuple: Vec3Tuple = [normal.x, normal.y, normal.z];
          onPick(snapToFaceCenter(link.dimensions, normalTuple), normalTuple);
        }}
        onPointerMove={(event) => {
          if (!onSnapHover) return;
          event.stopPropagation();
          const normal = event.face?.normal.clone().normalize() ?? new Vector3(1, 0, 0);
          const normalTuple: Vec3Tuple = [normal.x, normal.y, normal.z];
          onSnapHover(snapToFaceCenter(link.dimensions, normalTuple), normalTuple);
        }}
        onPointerOut={() => {
          onSnapOut?.();
        }}
      >
        <boxGeometry args={link.dimensions} />
        <meshStandardMaterial
          color={link.color}
          roughness={0.42}
          metalness={0.18}
          wireframe={wireframe}
          transparent={transparent}
          opacity={transparent ? 0.42 : 1}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[link.dimensions[0] * 0.18, 0, 0]}>
        <cylinderGeometry args={[link.dimensions[1] * 0.23, link.dimensions[1] * 0.23, link.dimensions[0] * 0.92, 48]} />
        <meshStandardMaterial
          color="#d6dde6"
          roughness={0.36}
          metalness={0.48}
          wireframe={wireframe}
          transparent={transparent}
          opacity={transparent ? 0.34 : 0.8}
        />
      </mesh>
    </group>
  );
}

function StepMeshPrimitive({
  mesh,
  fallbackColor,
  wireframe,
  transparent,
  onPick,
  onSnapHover,
  onSnapOut,
}: {
  mesh: StepMeshData;
  fallbackColor: string;
  wireframe?: boolean;
  transparent?: boolean;
  onPick?: (point: Vec3Tuple, normal: Vec3Tuple) => void;
  onSnapHover?: (point: Vec3Tuple, normal: Vec3Tuple) => void;
  onSnapOut?: () => void;
}) {
  const geometry = useMemo(() => {
    const next = new BufferGeometry();
    next.setAttribute("position", new BufferAttribute(new Float32Array(mesh.positions), 3));
    if (mesh.normals && mesh.normals.length === mesh.positions.length) {
      next.setAttribute("normal", new BufferAttribute(new Float32Array(mesh.normals), 3));
    }
    next.setIndex(mesh.indices);
    if (!mesh.normals) next.computeVertexNormals();
    next.computeBoundingSphere();
    next.computeBoundingBox();
    return next;
  }, [mesh.indices, mesh.normals, mesh.positions]);

  const getSnap = (faceIndex: number | undefined, hitPoint: Vector3): { center: Vec3Tuple; normal: Vec3Tuple } => {
    const faceRange = mesh.brepFaces?.find((face) => faceIndex !== undefined && faceIndex >= face.first && faceIndex <= face.last);
    if (!faceRange) {
      return { center: [hitPoint.x, hitPoint.y, hitPoint.z], normal: [1, 0, 0] };
    }

    const center = new Vector3();
    const normal = new Vector3();
    let vertexCount = 0;
    const positions = geometry.getAttribute("position");

    for (let triangle = faceRange.first; triangle <= faceRange.last; triangle += 1) {
      for (let corner = 0; corner < 3; corner += 1) {
        const vertexIndex = mesh.indices[triangle * 3 + corner];
        center.x += positions.getX(vertexIndex);
        center.y += positions.getY(vertexIndex);
        center.z += positions.getZ(vertexIndex);
        vertexCount += 1;
      }
    }

    if (vertexCount > 0) center.divideScalar(vertexCount);

    const normalAttr = geometry.getAttribute("normal");
    if (normalAttr && vertexCount > 0) {
      for (let triangle = faceRange.first; triangle <= faceRange.last; triangle += 1) {
        for (let corner = 0; corner < 3; corner += 1) {
          const vertexIndex = mesh.indices[triangle * 3 + corner];
          normal.x += normalAttr.getX(vertexIndex);
          normal.y += normalAttr.getY(vertexIndex);
          normal.z += normalAttr.getZ(vertexIndex);
        }
      }
      normal.normalize();
    }

    if (normal.lengthSq() < 0.000001) normal.set(1, 0, 0);
    return { center: [center.x, center.y, center.z], normal: [normal.x, normal.y, normal.z] };
  };

  const color = mesh.color ? `rgb(${mesh.color.map((value) => Math.round(value * 255)).join(",")})` : fallbackColor;

  return (
    <mesh
      castShadow
      receiveShadow
      geometry={geometry}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (!onPick) return;
        const local = event.object.worldToLocal(event.point.clone());
        const snap = getSnap(event.faceIndex ?? undefined, local);
        onPick(snap.center, snap.normal);
      }}
      onPointerMove={(event) => {
        if (!onSnapHover) return;
        event.stopPropagation();
        const local = event.object.worldToLocal(event.point.clone());
        const snap = getSnap(event.faceIndex ?? undefined, local);
        onSnapHover(snap.center, snap.normal);
      }}
      onPointerOut={() => onSnapOut?.()}
    >
      <meshStandardMaterial
        color={color}
        roughness={0.42}
        metalness={0.18}
        wireframe={wireframe}
        transparent={transparent}
        opacity={transparent ? 0.42 : 1}
      />
    </mesh>
  );
}

export function WorkspaceShell({ radius }: { radius: number }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 48, 24]} />
        <meshBasicMaterial color="#00C2CB" transparent opacity={0.065} wireframe />
      </mesh>
      <Line points={Array.from({ length: 80 }, (_, i) => {
        const angle = (i / 79) * Math.PI * 2;
        return [Math.cos(angle) * radius, Math.sin(angle) * radius, 0] as [number, number, number];
      })} color="#00C2CB" lineWidth={1} />
    </group>
  );
}
