import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, Grid } from "@react-three/drei";
import { ArrowRight, CircleDot, CornerDownRight, Crosshair, RotateCw } from "lucide-react";
import { useMemo, useState } from "react";
import { inferJointFromHit } from "../lib/geometry";
import { tupleToString } from "../lib/math";
import { useAppStore } from "../store";
import type { Vec3Tuple } from "../types";
import { AxisIndicator, JointMarker, LinkMesh, modelIndicatorScale, SnapPreview } from "./SceneHelpers";

export function DefinitionPage() {
  const links = useAppStore((state) => state.links);
  const baseLinkId = useAppStore((state) => state.baseLinkId);
  const selectedLinkId = useAppStore((state) => state.selectedLinkId);
  const definitionMode = useAppStore((state) => state.definitionMode);
  const setDefinitionMode = useAppStore((state) => state.setDefinitionMode);
  const setSelectedLink = useAppStore((state) => state.setSelectedLink);
  const updateLinkJoint = useAppStore((state) => state.updateLinkJoint);
  const setLinkChild = useAppStore((state) => state.setLinkChild);
  const setBaseLink = useAppStore((state) => state.setBaseLink);
  const setPage = useAppStore((state) => state.setPage);
  const [hoverSnap, setHoverSnap] = useState<{ center: Vec3Tuple; normal: Vec3Tuple } | null>(null);

  const selectedLink = useMemo(
    () => links.find((link) => link.id === selectedLinkId) ?? links[0],
    [links, selectedLinkId],
  );

  if (!selectedLink) return null;
  const indicatorScale = modelIndicatorScale(selectedLink.dimensions);

  const pickJoint = (point: Vec3Tuple, normal: Vec3Tuple) => {
    updateLinkJoint(selectedLink.id, inferJointFromHit(selectedLink, definitionMode, point, normal));
  };

  const jointRows = [
    { label: "Origin Point", value: selectedLink.originPoint },
    { label: "Rotation Joint", value: selectedLink.rotationJoint },
  ];

  return (
    <main className="definition-grid">
      <aside className="link-sidebar">
        <div className="panel-heading">
          <span>STEP links</span>
          <strong>{links.length}</strong>
        </div>
        <div className="link-stack">
          {links.map((link) => (
            <button
              key={link.id}
              type="button"
              className={[
                "link-card",
                link.id === selectedLink.id ? "selected" : "",
                link.id === baseLinkId ? "base-link" : "",
              ].join(" ")}
              onClick={() => setSelectedLink(link.id)}
            >
              <span className="file-index">{link.id === baseLinkId ? "B" : ""}</span>
              <span>{link.name}</span>
              <small>{link.meshStatus === "ready" ? "ready" : link.meshStatus}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="viewer-shell">
        <div className="viewer-toolbar">
          <div>
            <h2>{selectedLink.name}</h2>
            <p>Choose a label action on the right, then click a snapped face center.</p>
          </div>
        </div>
        <div className="canvas-wrap">
          <Canvas shadows>
            <PerspectiveCamera makeDefault position={[2.4, 2, 2.2]} fov={42} />
            <ambientLight intensity={0.55} />
            <directionalLight castShadow position={[3, 4, 5]} intensity={1.8} />
            <Environment preset="city" />
            <Grid args={[8, 8]} cellSize={0.5} sectionSize={1} fadeDistance={8} position={[0, -0.55, 0]} />
            <group>
              <LinkMesh
                link={selectedLink}
                onPick={pickJoint}
                onSnapHover={(center, normal) => setHoverSnap({ center, normal })}
                onSnapOut={() => setHoverSnap(null)}
              />
              {hoverSnap && <SnapPreview center={hoverSnap.center} normal={hoverSnap.normal} scale={indicatorScale} />}
              {selectedLink.originPoint && <JointMarker point={selectedLink.originPoint} scale={indicatorScale} />}
              {selectedLink.rotationJoint && <JointMarker point={selectedLink.rotationJoint} scale={indicatorScale} />}
            </group>
            <AxisIndicator />
            <OrbitControls makeDefault />
          </Canvas>
        </div>
      </section>

      <aside className="property-panel">
        <div className="panel-heading">
          <span>Labelling</span>
          <CircleDot size={18} />
        </div>
        <div className="label-actions">
          <button
            type="button"
            className={definitionMode === "origin" ? "primary-button full" : "secondary-button full"}
            onClick={() => setDefinitionMode("origin")}
          >
            <Crosshair size={16} /> Set origin
          </button>
          <button
            type="button"
            className={definitionMode === "rotation" ? "primary-button full" : "secondary-button full"}
            onClick={() => setDefinitionMode("rotation")}
          >
            <RotateCw size={16} /> Set rotation point
          </button>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={baseLinkId === selectedLink.id}
            onChange={(event) => setBaseLink(event.target.checked ? selectedLink.id : undefined)}
          />
          <span>is_base_link</span>
        </label>
        <div className="joint-readout">
          <div className="readout-title">
            <CornerDownRight size={16} />
            <strong>Child Link</strong>
          </div>
          <select
            className="child-select"
            value={selectedLink.childLinkId ?? ""}
            onChange={(event) => setLinkChild(selectedLink.id, event.target.value || undefined)}
          >
            <option value="">No child link</option>
            {links
              .filter((link) => link.id !== selectedLink.id)
              .map((link) => (
                <option key={link.id} value={link.id}>
                  {link.name}
                </option>
              ))}
          </select>
          <p className="muted">The selected child's origin will attach to this link's rotation joint.</p>
        </div>
        {jointRows.map((row) => (
          <div className="joint-readout" key={row.label}>
            <div className="readout-title">
              <CornerDownRight size={16} />
              <strong>{row.label}</strong>
            </div>
            {row.value ? (
              <dl>
                <dt>Center</dt>
                <dd>{tupleToString(row.value.center)}</dd>
                <dt>Axis</dt>
                <dd>{tupleToString(row.value.axis)}</dd>
                <dt>Radius</dt>
                <dd>{row.value.radius.toFixed(3)} m</dd>
                <dt>Normal</dt>
                <dd>{tupleToString(row.value.normal)}</dd>
              </dl>
            ) : (
              <p className="muted">Not selected yet.</p>
            )}
          </div>
        ))}
        <button type="button" className="primary-button full" onClick={() => setPage("assembly")}>
          Assemble robot <ArrowRight size={17} />
        </button>
      </aside>
    </main>
  );
}
