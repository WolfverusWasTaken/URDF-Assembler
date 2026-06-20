import { Canvas } from "@react-three/fiber";
import { Environment, Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Box, CircleAlert, Eye, GitBranch, Layers, ScanEye } from "lucide-react";
import { useMemo, useState } from "react";
import { Euler, Quaternion } from "three";
import { detectCollisionPairs, getLinkTransforms } from "../lib/robot";
import { toVector } from "../lib/math";
import { useAppStore } from "../store";
import type { JointType, RobotJoint, Vec3Tuple } from "../types";
import { AxisIndicator, CoordinateFrame, JointAxisIndicator, LinkMesh, modelIndicatorScale, WorkspaceShell } from "./SceneHelpers";

const jointTypes: JointType[] = ["revolute", "continuous", "prismatic", "fixed"];

export function AssemblyPage() {
  const links = useAppStore((state) => state.links);
  const joints = useAppStore((state) => state.joints);
  const baseLinkId = useAppStore((state) => state.baseLinkId);
  const selectedLinkId = useAppStore((state) => state.selectedLinkId);
  const options = useAppStore((state) => state.options);
  const selectedJointId = useAppStore((state) => state.selectedJointId);
  const setSelectedLink = useAppStore((state) => state.setSelectedLink);
  const setSelectedJoint = useAppStore((state) => state.setSelectedJoint);
  const setJointValue = useAppStore((state) => state.setJointValue);
  const setLinkOrientation = useAppStore((state) => state.setLinkOrientation);
  const setPage = useAppStore((state) => state.setPage);
  const updateJoint = useAppStore((state) => state.updateJoint);
  const toggleOption = useAppStore((state) => state.toggleOption);

  const selectedJoint = useMemo(
    () => joints.find((joint) => joint.id === selectedJointId) ?? joints[0],
    [joints, selectedJointId],
  );
  const selectedLink = useMemo(
    () => links.find((link) => link.id === selectedLinkId) ?? links[0],
    [links, selectedLinkId],
  );
  const collisions = detectCollisionPairs(links, joints, options.exploded, baseLinkId);
  const reach = links.reduce((sum, link) => sum + link.dimensions[0], 0);
  const transforms = getLinkTransforms(links, joints, options.exploded, baseLinkId);
  const assemblyIndicatorScale = modelIndicatorScale([
    Math.max(...links.map((link) => link.dimensions[0]), 0.01),
    Math.max(...links.map((link) => link.dimensions[1]), 0.01),
    Math.max(...links.map((link) => link.dimensions[2]), 0.01),
  ]);

  return (
    <main className="assembly-grid">
      <aside className="hierarchy-panel">
        <div className="panel-heading">
          <span>Robot hierarchy</span>
          <GitBranch size={18} />
        </div>
        <div className="tree">
          {links.map((link) => {
            const childJoint = joints.find((joint) => joint.parentLinkId === link.id);
            return (
            <div key={link.id}>
              <button
                type="button"
                className={selectedLink?.id === link.id ? "tree-link selected" : "tree-link"}
                onClick={() => {
                  setSelectedLink(link.id);
                }}
              >
                <Box size={15} />
                <span>{link.id === baseLinkId ? "base_link" : link.name}</span>
              </button>
              {childJoint && (
                <button
                  type="button"
                  className={selectedJoint?.id === childJoint.id ? "tree-joint selected" : "tree-joint"}
                  onClick={() => {
                    setSelectedJoint(childJoint.id);
                  }}
                >
                  <span className="joint-dot" />
                  {childJoint.name}
                </button>
              )}
            </div>
          );
          })}
        </div>
        <div className="status-list">
          <span>Mass estimate: {links.reduce((sum, link) => sum + link.mass, 0).toFixed(2)} kg</span>
          <span>Workspace radius: {reach.toFixed(2)} m</span>
          <span>{collisions.length === 0 ? "No self-collision detected" : `${collisions.length} collision warning(s)`}</span>
        </div>
      </aside>

      <section className="assembly-viewer">
        <div className="viewer-toolbar compact">
          <div className="tool-cluster">
            <Toggle active={options.exploded} onClick={() => toggleOption("exploded")} icon={<Layers size={16} />} label="Exploded" />
            <Toggle active={options.wireframe} onClick={() => toggleOption("wireframe")} icon={<ScanEye size={16} />} label="Wire" />
            <Toggle active={options.transparent} onClick={() => toggleOption("transparent")} icon={<Eye size={16} />} label="Transparent" />
          </div>
          <div className="tool-cluster">
            <Toggle active={options.workspace} onClick={() => toggleOption("workspace")} icon={<Layers size={16} />} label="Workspace" />
            <Toggle active={options.collisions} onClick={() => toggleOption("collisions")} icon={<CircleAlert size={16} />} label="Collision" />
          </div>
        </div>
        <div className="canvas-wrap tall">
          <Canvas shadows>
            <PerspectiveCamera makeDefault position={[4.4, 3.4, 3.2]} fov={43} />
            <ambientLight intensity={0.55} />
            <directionalLight castShadow position={[4, 6, 5]} intensity={1.7} />
            <Environment preset="warehouse" />
            <Grid args={[12, 12]} cellSize={0.5} sectionSize={1} fadeDistance={10} position={[0, -0.65, 0]} />
            {options.workspace && <WorkspaceShell radius={Math.max(assemblyIndicatorScale * 8, reach)} />}
            {links.map((link, index) => (
              <group
                key={link.id}
                position={transforms.get(link.id)?.position ?? [index * 1.6, 0, 0]}
                quaternion={transforms.get(link.id)?.rotation ?? new Quaternion()}
              >
                <group rotation={link.orientation}>
                  <LinkMesh link={link} wireframe={options.wireframe} transparent={options.transparent} />
                  {options.frames && <CoordinateFrame scale={modelIndicatorScale(link.dimensions) * 2.2} />}
                </group>
              </group>
            ))}
            {joints.map((joint) => {
              const parentTransform = transforms.get(joint.parentLinkId);
              const parent = links.find((link) => link.id === joint.parentLinkId);
              if (!parentTransform || !parent) return null;
              const parentVisualRotation = parentTransform.rotation
                .clone()
                .multiply(new Quaternion().setFromEuler(new Euler(parent.orientation[0], parent.orientation[1], parent.orientation[2])));
              const parentJointWorld = toVector(parentTransform.position).add(
                toVector(joint.origin).applyQuaternion(parentVisualRotation),
              );
              const worldAxis = toVector(joint.axis)
                .normalize()
                .applyQuaternion(parentVisualRotation)
                .normalize()
                .toArray() as Vec3Tuple;
              return (
                <group key={`${joint.id}-axis`} position={parentJointWorld}>
                  <JointAxisIndicator axis={worldAxis} label={axisLabel(joint.axis)} scale={assemblyIndicatorScale} />
                </group>
              );
            })}
            <AxisIndicator />
            <OrbitControls makeDefault />
          </Canvas>
        </div>
        <div className="slider-dock">
          {joints.map((joint) => (
            <label key={joint.id} className="slider-row">
              <span>{jointLabel(joint, links)}</span>
              <input
                type="range"
                min={joint.type === "continuous" ? -3.14 : joint.limitLower}
                max={joint.type === "continuous" ? 3.14 : joint.limitUpper}
                step="0.01"
                value={joint.value}
                disabled={joint.type === "fixed"}
                onChange={(event) => setJointValue(joint.id, Number(event.target.value))}
              />
              <strong>{joint.value.toFixed(2)}</strong>
            </label>
          ))}
        </div>
      </section>

      <aside className="property-panel assembly-props">
        <div className="panel-heading">
          <span>Link orientation</span>
          <strong>{selectedLink?.name ?? "none"}</strong>
        </div>
        {selectedLink ? (
          <div className="orientation-panel">
            <OrientationSlider
              label="Rotate left / right"
              value={selectedLink.orientation[1]}
              onChange={(value) => setLinkOrientation(selectedLink.id, [selectedLink.orientation[0], value, selectedLink.orientation[2]])}
            />
            <OrientationSlider
              label="Rotate up / down"
              value={selectedLink.orientation[0]}
              onChange={(value) => setLinkOrientation(selectedLink.id, [value, selectedLink.orientation[1], selectedLink.orientation[2]])}
            />
            <OrientationSlider
              label="Roll clockwise"
              value={selectedLink.orientation[2]}
              onChange={(value) => setLinkOrientation(selectedLink.id, [selectedLink.orientation[0], selectedLink.orientation[1], value])}
            />
          </div>
        ) : (
          <p className="muted">Select a link to edit its base orientation.</p>
        )}

        <div className="panel-heading joint-panel-heading">
          <span>Active Joint</span>
          <strong>{selectedJoint?.name ?? "none"}</strong>
        </div>
        {selectedJoint ? (
          <div className="joint-form">
            <label>
              Type
              <select value={selectedJoint.type} onChange={(event) => updateJoint(selectedJoint.id, { type: event.target.value as JointType })}>
                {jointTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <AxisPicker joint={selectedJoint} onChange={(axis) => updateJoint(selectedJoint.id, { axis })} />
            <NumberField label="Lower limit" value={selectedJoint.limitLower} onChange={(value) => updateJoint(selectedJoint.id, { limitLower: value })} />
            <NumberField label="Upper limit" value={selectedJoint.limitUpper} onChange={(value) => updateJoint(selectedJoint.id, { limitUpper: value })} />
            <NumberField label="Velocity" value={selectedJoint.velocity} onChange={(value) => updateJoint(selectedJoint.id, { velocity: value })} />
            <EffortField key={selectedJoint.id} joint={selectedJoint} onChange={(value) => updateJoint(selectedJoint.id, { effort: value })} />
            <NumberField label="Damping" value={selectedJoint.damping} onChange={(value) => updateJoint(selectedJoint.id, { damping: value })} />
            <NumberField label="Friction" value={selectedJoint.friction} onChange={(value) => updateJoint(selectedJoint.id, { friction: value })} />
          </div>
        ) : (
          <p className="muted">Select a joint to edit limits, axis, and motor behavior.</p>
        )}
        {options.collisions && collisions.length > 0 && (
          <div className="warning-box">
            {collisions.map((collision) => <span key={collision}>{collision}</span>)}
          </div>
        )}
        <button type="button" className="primary-button full export-forward" onClick={() => setPage("export")}>
          Export package
        </button>
      </aside>
    </main>
  );
}

const effortUnits = [
  { label: "Nm", multiplier: 1 },
  { label: "Ncm", multiplier: 0.01 },
  { label: "kgf-cm", multiplier: 0.0980665 },
  { label: "oz-in", multiplier: 0.00706155 },
] as const;

function EffortField({ joint, onChange }: { joint: RobotJoint; onChange: (value: number) => void }) {
  const [unit, setUnit] = useState<(typeof effortUnits)[number]["label"]>("Nm");
  const activeUnit = effortUnits.find((entry) => entry.label === unit) ?? effortUnits[0];
  const displayValue = joint.effort / activeUnit.multiplier;

  return (
    <label className="effort-field">
      Effort limit
      <div className="effort-row">
        <input
          type="number"
          step="0.01"
          value={Number(displayValue.toFixed(3))}
          onChange={(event) => onChange(Number(event.target.value) * activeUnit.multiplier)}
        />
        <select value={unit} onChange={(event) => setUnit(event.target.value as (typeof effortUnits)[number]["label"])}>
          {effortUnits.map((entry) => (
            <option key={entry.label} value={entry.label}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function OrientationSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const degrees = Math.round((value * 180) / Math.PI);

  return (
    <label className="orientation-row">
      <span>{label}</span>
      <input
        type="range"
        min="-180"
        max="180"
        step="1"
        value={degrees}
        onChange={(event) => onChange((Number(event.target.value) * Math.PI) / 180)}
      />
      <strong>{degrees} deg</strong>
    </label>
  );
}

function jointLabel(joint: RobotJoint, links: Array<{ id: string; name: string }>) {
  const parent = links.find((link) => link.id === joint.parentLinkId)?.name ?? "parent";
  const child = links.find((link) => link.id === joint.childLinkId)?.name ?? "child";
  return `${joint.name}: ${parent} -> ${child}`;
}

const axisOptions: Array<{ label: string; value: Vec3Tuple }> = [
  { label: "X axis (1 0 0)", value: [1, 0, 0] },
  { label: "Y axis (0 1 0)", value: [0, 1, 0] },
  { label: "Z axis (0 0 1)", value: [0, 0, 1] },
];

function isSameAxis(a: Vec3Tuple, b: Vec3Tuple) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function axisLabel(axis: Vec3Tuple) {
  if (isSameAxis(axis, [1, 0, 0])) return "X";
  if (isSameAxis(axis, [0, 1, 0])) return "Y";
  if (isSameAxis(axis, [0, 0, 1])) return "Z";
  return `${axis[0]} ${axis[1]} ${axis[2]}`;
}

function AxisPicker({ joint, onChange }: { joint: RobotJoint; onChange: (axis: Vec3Tuple) => void }) {
  return (
    <fieldset className="axis-picker">
      <legend>Rotation axis</legend>
      {axisOptions.map((option) => (
        <label key={option.label} className="axis-choice">
          <input
            type="checkbox"
            checked={isSameAxis(joint.axis, option.value)}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function Toggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" className={active ? "tool-toggle active" : "tool-toggle"} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      {label}
      <input type="number" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
