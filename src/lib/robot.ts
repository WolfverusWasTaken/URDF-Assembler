import { Euler, Quaternion, Vector3 } from "three";
import type { RobotJoint, RobotLink, RobotOptions, Vec3Tuple } from "../types";

export const defaultOptions: RobotOptions = {
  exploded: false,
  wireframe: false,
  transparent: false,
  frames: true,
  workspace: true,
  collisions: true,
};

export const buildRobotJoints = (links: RobotLink[], existing: RobotJoint[] = []): RobotJoint[] => {
  const joints: RobotJoint[] = [];

  for (let index = 0; index < links.length; index += 1) {
    const parent = links[index];
    const child = links.find((link) => link.id === parent.childLinkId);
    if (!child) continue;
    const prior = existing.find((joint) => joint.parentLinkId === parent.id && joint.childLinkId === child.id);
    const axis: Vec3Tuple = prior?.axis ?? parent.rotationJoint?.axis ?? [0, 0, 1];
    const origin: Vec3Tuple = parent.rotationJoint?.center ?? [parent.dimensions[0] / 2, 0, 0];
    const sequence = joints.length + 1;

    joints.push({
      id: prior?.id ?? crypto.randomUUID(),
      name: `joint_${sequence}`,
      type: prior?.type ?? "revolute",
      parentLinkId: parent.id,
      childLinkId: child.id,
      axis,
      origin,
      limitLower: prior?.limitLower ?? -1.57,
      limitUpper: prior?.limitUpper ?? 1.57,
      velocity: prior?.velocity ?? 1.2,
      effort: prior?.effort ?? 20,
      damping: prior?.damping ?? 0.04,
      friction: prior?.friction ?? 0.01,
      value: prior?.value ?? 0,
    });
  }

  return joints;
};

export interface LinkTransform {
  position: Vec3Tuple;
  rotation: Quaternion;
}

const toVector = (value: Vec3Tuple) => new Vector3(value[0], value[1], value[2]);
const toTuple = (value: Vector3): Vec3Tuple => [value.x, value.y, value.z];
const orientationQuaternion = (link: RobotLink) =>
  new Quaternion().setFromEuler(new Euler(link.orientation[0], link.orientation[1], link.orientation[2]));

const visualRotation = (transform: LinkTransform, link: RobotLink) =>
  transform.rotation.clone().multiply(orientationQuaternion(link));

export const getLinkTransforms = (links: RobotLink[], joints: RobotJoint[], exploded: boolean, baseLinkId?: string) => {
  const transforms = new Map<string, LinkTransform>();
  const childIds = new Set(links.map((link) => link.childLinkId).filter(Boolean));
  const roots = links.filter((link) => !childIds.has(link.id));
  const root = links.find((link) => link.id === baseLinkId) ?? roots[0] ?? links[0];
  if (!root) return transforms;

  const rootRotation = new Quaternion();
  const rootVisualRotation = rootRotation.clone().multiply(orientationQuaternion(root));
  const rootOrigin = root.originPoint?.center ?? [0, 0, 0];
  transforms.set(root.id, {
    position: toTuple(toVector(rootOrigin).applyQuaternion(rootVisualRotation).negate()),
    rotation: rootRotation,
  });

  let changed = true;
  while (changed) {
    changed = false;
    for (const joint of joints) {
      const parentTransform = transforms.get(joint.parentLinkId);
      const parent = links.find((link) => link.id === joint.parentLinkId);
      const child = links.find((link) => link.id === joint.childLinkId);
      if (!parentTransform || !parent || !child || transforms.has(child.id)) continue;

      const childOrigin = child.originPoint?.center ?? [0, 0, 0];
      const parentVisualRotation = visualRotation(parentTransform, parent);
      const parentJointWorld = toVector(parentTransform.position).add(toVector(joint.origin).applyQuaternion(parentVisualRotation));
      const axisWorld = toVector(joint.axis).normalize().applyQuaternion(parentVisualRotation).normalize();

      if (joint.type === "prismatic") {
        parentJointWorld.add(axisWorld.clone().multiplyScalar(joint.value));
      }

      const jointValue = joint.type === "revolute" || joint.type === "continuous" ? joint.value : 0;
      const jointRotation = new Quaternion().setFromAxisAngle(axisWorld, jointValue);
      const childRotation = jointRotation.clone().multiply(parentVisualRotation);
      const childVisualRotation = childRotation.clone().multiply(orientationQuaternion(child));
      const childPosition = parentJointWorld.clone().sub(toVector(childOrigin).applyQuaternion(childVisualRotation));

      transforms.set(child.id, { position: toTuple(childPosition), rotation: childRotation });
      changed = true;
    }
  }

  links.forEach((link, index) => {
    if (!transforms.has(link.id)) {
      transforms.set(link.id, { position: [index * 1.6, exploded ? index * 0.38 : 0, 0], rotation: new Quaternion() });
    }
  });

  if (exploded) {
    links.forEach((link, index) => {
      const transform = transforms.get(link.id);
      if (transform) transforms.set(link.id, { ...transform, position: [transform.position[0], transform.position[1] + index * 0.38, transform.position[2]] });
    });
  }

  return transforms;
};

export const getLinkPosition = (
  linkIndex: number,
  links: RobotLink[],
  joints: RobotJoint[],
  exploded: boolean,
  baseLinkId?: string,
): Vec3Tuple => {
  return getLinkTransforms(links, joints, exploded, baseLinkId).get(links[linkIndex]?.id)?.position ?? [0, 0, 0];
};

export const detectCollisionPairs = (links: RobotLink[], joints: RobotJoint[], exploded: boolean, baseLinkId?: string) => {
  const collisions: string[] = [];

  for (let a = 0; a < links.length; a += 1) {
    for (let b = a + 2; b < links.length; b += 1) {
      const pa = getLinkPosition(a, links, joints, exploded, baseLinkId);
      const pb = getLinkPosition(b, links, joints, exploded, baseLinkId);
      const distance = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
      const threshold = (links[a].dimensions[0] + links[b].dimensions[0]) * 0.3;
      if (distance < threshold) collisions.push(`${links[a].name} touches ${links[b].name}`);
    }
  }

  return collisions;
};
