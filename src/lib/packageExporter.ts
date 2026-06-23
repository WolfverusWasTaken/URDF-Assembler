import JSZip from "jszip";
import { Euler, Quaternion, Vector3 } from "three";
import type { RobotJoint, RobotLink, StepMeshData, Vec3Tuple } from "../types";
import { computeLinkPhysicalSummary, resolvePhysicalBodies, validatePhysicalSummary } from "./physics";
import { formatNumber, tupleToString } from "./math";

const robotName = "urdf_assembler_robot";

const cleanName = (value: string) =>
  (value || "link")
    .replace(/\.(step|stp)$/i, "")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || "link";

const xmlEscape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const qFromOrientation = (orientation: Vec3Tuple) =>
  new Quaternion().setFromEuler(new Euler(orientation[0], orientation[1], orientation[2]));

const vector = (value: Vec3Tuple) => new Vector3(value[0], value[1], value[2]);

const inferExportScale = (link: RobotLink) => {
  const maxDimension = Math.max(...link.dimensions);
  if (maxDimension <= 0.05) return 1000;
  if (maxDimension >= 50) return 0.001;
  return 1;
};

const bakedPoint = (point: Vec3Tuple, link: RobotLink) => {
  const origin = link.originPoint?.center ?? [0, 0, 0];
  return vector(point).sub(vector(origin)).applyQuaternion(qFromOrientation(link.orientation));
};

const bakedDirection = (direction: Vec3Tuple, link: RobotLink) =>
  vector(direction).normalize().applyQuaternion(qFromOrientation(link.orientation)).normalize();

const makeFallbackMesh = (link: RobotLink): StepMeshData[] => {
  const [x, y, z] = link.dimensions.map((value) => value / 2) as Vec3Tuple;
  const positions = [
    -x, -y, -z, x, -y, -z, x, y, -z, -x, y, -z,
    -x, -y, z, x, -y, z, x, y, z, -x, y, z,
  ];
  const indices = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0,
  ];
  return [{ id: `${link.id}-fallback`, name: link.name, positions, indices }];
};

export const linkExportName = (link: RobotLink) => cleanName(link.name);

const bakedMeshes = (link: RobotLink): StepMeshData[] => {
  const meshes = link.meshes && link.meshes.length > 0 ? link.meshes : makeFallbackMesh(link);
  const exportScale = inferExportScale(link);
  return meshes.map((mesh) => {
    const positions: number[] = [];
    for (let index = 0; index < mesh.positions.length; index += 3) {
      const point = bakedPoint([mesh.positions[index], mesh.positions[index + 1], mesh.positions[index + 2]], link);
      positions.push(point.x * exportScale, point.y * exportScale, point.z * exportScale);
    }
    return { ...mesh, positions };
  });
};

export const createBakedAsciiStl = (link: RobotLink) => {
  const meshes = bakedMeshes(link);
  const lines = [`solid ${linkExportName(link)}`];

  for (const mesh of meshes) {
    for (let index = 0; index < mesh.indices.length; index += 3) {
      const a = vertexAt(mesh, mesh.indices[index]);
      const b = vertexAt(mesh, mesh.indices[index + 1]);
      const c = vertexAt(mesh, mesh.indices[index + 2]);
      const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();

      lines.push(`  facet normal ${formatVector(normal)}`);
      lines.push("    outer loop");
      lines.push(`      vertex ${formatVector(a)}`);
      lines.push(`      vertex ${formatVector(b)}`);
      lines.push(`      vertex ${formatVector(c)}`);
      lines.push("    endloop");
      lines.push("  endfacet");
    }
  }

  lines.push(`endsolid ${linkExportName(link)}`);
  return lines.join("\n");
};

const vertexAt = (mesh: StepMeshData, vertexIndex: number) => {
  const offset = vertexIndex * 3;
  return new Vector3(mesh.positions[offset], mesh.positions[offset + 1], mesh.positions[offset + 2]);
};

const formatVector = (value: Vector3) =>
  `${formatNumber(value.x, 8)} ${formatNumber(value.y, 8)} ${formatNumber(value.z, 8)}`;

const jointOriginInParent = (joint: RobotJoint, parent: RobotLink) => {
  const origin = parent.originPoint?.center ?? [0, 0, 0];
  return vector(joint.origin).sub(vector(origin)).applyQuaternion(qFromOrientation(parent.orientation)).toArray() as Vec3Tuple;
};

const jointAxisInParent = (joint: RobotJoint, parent: RobotLink) =>
  bakedDirection(joint.axis, parent).toArray() as Vec3Tuple;

export const createCleanUrdf = (links: RobotLink[], joints: RobotJoint[]) => {
  const linkXml = links
    .map((link) => {
      const name = linkExportName(link);
      const meshes = bakedMeshes(link);
      const bodies = resolvePhysicalBodies(meshes, link.physicalBodies);
      const inertial = computeLinkPhysicalSummary(meshes, bodies);
      const inertia = inertial.inertia;
      const meshPath = `package://${robotName}/meshes/${name}.stl`;

      return `  <link name="${xmlEscape(name)}">
    <inertial>
      <origin xyz="${tupleToString(inertial.centerOfMass, 8)}" rpy="0 0 0"/>
      <mass value="${formatNumber(inertial.totalMass, 8)}"/>
      <inertia ixx="${formatNumber(inertia.ixx, 10)}" ixy="${formatNumber(inertia.ixy, 10)}" ixz="${formatNumber(inertia.ixz, 10)}" iyy="${formatNumber(inertia.iyy, 10)}" iyz="${formatNumber(inertia.iyz, 10)}" izz="${formatNumber(inertia.izz, 10)}"/>
    </inertial>
    <visual>
      <geometry><mesh filename="${meshPath}"/></geometry>
    </visual>
    <collision>
      <geometry><mesh filename="${meshPath}"/></geometry>
    </collision>
  </link>`;
    })
    .join("\n");

  const jointXml = joints
    .map((joint) => {
      const parent = links.find((link) => link.id === joint.parentLinkId);
      const child = links.find((link) => link.id === joint.childLinkId);
      if (!parent || !child) return "";
      const origin = jointOriginInParent(joint, parent);
      const axis = jointAxisInParent(joint, parent);

      return `  <joint name="${xmlEscape(joint.name)}" type="${joint.type}">
    <parent link="${xmlEscape(linkExportName(parent))}"/>
    <child link="${xmlEscape(linkExportName(child))}"/>
    <origin xyz="${tupleToString(origin, 8)}" rpy="0 0 0"/>
    <axis xyz="${tupleToString(axis, 8)}"/>
    <limit lower="${formatNumber(joint.limitLower)}" upper="${formatNumber(joint.limitUpper)}" velocity="${formatNumber(joint.velocity)}" effort="${formatNumber(joint.effort)}"/>
    <dynamics damping="${formatNumber(joint.damping)}" friction="${formatNumber(joint.friction)}"/>
  </joint>`;
    })
    .filter(Boolean)
    .join("\n");

  return `<robot name="${robotName}">\n${linkXml}\n${jointXml}\n</robot>\n`;
};

export const createSrdf = (links: RobotLink[]) => `<robot name="${robotName}">
  <group name="manipulator">
${links.map((link) => `    <link name="${xmlEscape(linkExportName(link))}"/>`).join("\n")}
  </group>
</robot>
`;

export const createJointLimitsYaml = (joints: RobotJoint[]) =>
  `joint_limits:\n${joints
    .map(
      (joint) =>
        `  ${joint.name}:\n    has_velocity_limits: true\n    max_velocity: ${formatNumber(joint.velocity)}\n    has_acceleration_limits: false`,
    )
    .join("\n")}\n`;

export const createRobotPackageZip = async ({
  links,
  joints,
  includeMoveIt,
}: {
  links: RobotLink[];
  joints: RobotJoint[];
  includeMoveIt: boolean;
}) => {
  const zip = new JSZip();
  const root = zip.folder(robotName)!;
  const meshes = root.folder("meshes")!;
  const urdf = root.folder("urdf")!;

  links.forEach((link) => {
    meshes.file(`${linkExportName(link)}.stl`, createBakedAsciiStl(link));
  });

  urdf.file(`${robotName}.urdf`, createCleanUrdf(links, joints));
  root.file(
    "package.xml",
    `<package format="3">
  <name>${robotName}</name>
  <version>0.1.0</version>
  <description>Generated by URDF Assembler.</description>
  <maintainer email="user@example.com">URDF Assembler</maintainer>
  <license>Proprietary</license>
</package>
`,
  );
  root.file(
    "CMakeLists.txt",
    `cmake_minimum_required(VERSION 3.8)
project(${robotName})
find_package(ament_cmake REQUIRED)
install(DIRECTORY meshes urdf config DESTINATION share/\${PROJECT_NAME})
ament_package()
`,
  );

  if (includeMoveIt) {
    const config = root.folder("config")!;
    config.file(`${robotName}.srdf`, createSrdf(links));
    config.file("joint_limits.yaml", createJointLimitsYaml(joints));
    config.file(
      "kinematics.yaml",
      `manipulator:
  kinematics_solver: kdl_kinematics_plugin/KDLKinematicsPlugin
  kinematics_solver_search_resolution: 0.005
  kinematics_solver_timeout: 0.05
`,
    );
  } else {
    root.folder("config");
  }

  return zip.generateAsync({ type: "blob" });
};

export const validateRobotLink = (link: RobotLink) => {
  const meshes = bakedMeshes(link);
  const bodies = resolvePhysicalBodies(meshes, link.physicalBodies);
  const summary = computeLinkPhysicalSummary(meshes, bodies);
  const validation = validatePhysicalSummary(summary);
  return { summary, validation };
};
