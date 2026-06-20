import type { RobotJoint, RobotLink } from "../types";
import { estimateBoxInertia, formatNumber, tupleToString } from "./math";

const xmlEscape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const generateUrdf = (links: RobotLink[], joints: RobotJoint[]) => {
  const linkXml = links
    .map((link) => {
      const inertia = estimateBoxInertia(link.mass, link.dimensions);
      return `  <link name="${xmlEscape(link.name)}">
    <inertial>
      <mass value="${formatNumber(link.mass)}"/>
      <inertia ixx="${formatNumber(inertia.ixx)}" ixy="0" ixz="0" iyy="${formatNumber(inertia.iyy)}" iyz="0" izz="${formatNumber(inertia.izz)}"/>
    </inertial>
  </link>`;
    })
    .join("\n");

  const jointXml = joints
    .map((joint) => `  <joint name="${xmlEscape(joint.name)}" type="${joint.type === "continuous" ? "continuous" : joint.type}">
    <parent link="${xmlEscape(links.find((link) => link.id === joint.parentLinkId)?.name ?? "base_link")}"/>
    <child link="${xmlEscape(links.find((link) => link.id === joint.childLinkId)?.name ?? "link")}"/>
    <origin xyz="${tupleToString(joint.origin)}" rpy="0 0 0"/>
    <axis xyz="${tupleToString(joint.axis)}"/>
    <limit lower="${formatNumber(joint.limitLower)}" upper="${formatNumber(joint.limitUpper)}" velocity="${formatNumber(joint.velocity)}" effort="${formatNumber(joint.effort)}"/>
    <dynamics damping="${formatNumber(joint.damping)}" friction="${formatNumber(joint.friction)}"/>
  </joint>`)
    .join("\n");

  return `<robot name="urdf_assembler_robot">\n${linkXml}\n${jointXml}\n</robot>\n`;
};

export const generateSrdf = (links: RobotLink[]) => `<robot name="urdf_assembler_robot">
  <group name="manipulator">
${links.map((link) => `    <link name="${xmlEscape(link.name)}"/>`).join("\n")}
  </group>
</robot>
`;

export const generateMoveItPackage = (links: RobotLink[], joints: RobotJoint[]) => `moveit_config/
  config/urdf_assembler_robot.urdf
  config/urdf_assembler_robot.srdf
  config/joint_limits.yaml

joint_limits:
${joints.map((joint) => `  ${joint.name}: { has_velocity_limits: true, max_velocity: ${formatNumber(joint.velocity)}, has_acceleration_limits: false }`).join("\n")}

links: ${links.map((link) => link.name).join(", ")}
`;

export const generateMjcf = (links: RobotLink[], joints: RobotJoint[]) => `<mujoco model="urdf_assembler_robot">
  <worldbody>
${links.map((link, index) => `    <body name="${xmlEscape(link.name)}" pos="${index} 0 0">
      <geom type="box" size="${tupleToString(link.dimensions.map((v) => v / 2) as [number, number, number])}" mass="${formatNumber(link.mass)}"/>
    </body>`).join("\n")}
  </worldbody>
  <!-- ${joints.length} joints exported from URDF Assembler -->
</mujoco>
`;

export const generateSdf = (links: RobotLink[], joints: RobotJoint[]) => `<sdf version="1.10">
  <model name="urdf_assembler_robot">
${links.map((link) => `    <link name="${xmlEscape(link.name)}"/>`).join("\n")}
${joints.map((joint) => `    <joint name="${xmlEscape(joint.name)}" type="${joint.type}"/>`).join("\n")}
  </model>
</sdf>
`;

export const generatePyBullet = () => `import pybullet as p
import pybullet_data

p.connect(p.GUI)
p.setAdditionalSearchPath(pybullet_data.getDataPath())
robot_id = p.loadURDF("urdf_assembler_robot.urdf", useFixedBase=True)
p.setGravity(0, 0, -9.81)
while True:
    p.stepSimulation()
`;

export const generateUsd = (links: RobotLink[]) => `#usda 1.0
(
    defaultPrim = "URDFAssemblerRobot"
)

def Xform "URDFAssemblerRobot"
{
${links.map((link) => `    def Xform "${link.name}" {}`).join("\n")}
}
`;
