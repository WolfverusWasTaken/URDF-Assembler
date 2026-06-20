import { Canvas } from "@react-three/fiber";
import { Environment, Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { ArrowRight, Box, CheckCircle2, CircleDot, GitBranch, Layers3, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { computeLinkPhysicalSummary, materialPresets, resolvePhysicalBodies, validatePhysicalSummary } from "../lib/physics";
import { useAppStore } from "../store";
import type { PhysicalMaterialName, Vec3Tuple } from "../types";
import { AxisIndicator, JointMarker, LinkMesh, modelIndicatorScale, SnapPreview } from "./SceneHelpers";

export function PhysicalPropertiesPage() {
  const links = useAppStore((state) => state.links);
  const selectedLinkId = useAppStore((state) => state.selectedLinkId);
  const setSelectedLink = useAppStore((state) => state.setSelectedLink);
  const updatePhysicalBody = useAppStore((state) => state.updatePhysicalBody);
  const mergePhysicalBodies = useAppStore((state) => state.mergePhysicalBodies);
  const setPage = useAppStore((state) => state.setPage);

  const selectedLink = useMemo(
    () => links.find((link) => link.id === selectedLinkId) ?? links[0],
    [links, selectedLinkId],
  );
  const physicalBodies = useMemo(
    () => resolvePhysicalBodies(selectedLink?.meshes ?? [], selectedLink?.physicalBodies),
    [selectedLink?.meshes, selectedLink?.physicalBodies],
  );
  const physicalSummary = useMemo(
    () => computeLinkPhysicalSummary(selectedLink?.meshes ?? [], physicalBodies),
    [physicalBodies, selectedLink?.meshes],
  );
  const physicalValidation = useMemo(() => validatePhysicalSummary(physicalSummary), [physicalSummary]);
  const [selectedBodyIds, setSelectedBodyIds] = useState<string[]>([]);
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [hoveredBodyId, setHoveredBodyId] = useState<string | null>(null);
  const [hoverSnap, setHoverSnap] = useState<{ center: Vec3Tuple; normal: Vec3Tuple } | null>(null);

  useEffect(() => {
    if (!selectedLink) return;
    setSelectedBodyIds([]);
    setSelectedBodyId((current) => {
      if (current && physicalBodies.some((body) => body.id === current)) return current;
      return physicalBodies[0]?.id ?? null;
    });
    setHoveredBodyId(null);
    setHoverSnap(null);
  }, [selectedLink?.id, physicalBodies]);

  if (!selectedLink) return null;

  const selectedBody = physicalBodies.find((body) => body.id === selectedBodyId) ?? physicalBodies[0] ?? null;
  const activeBody = hoveredBodyId ? physicalBodies.find((body) => body.id === hoveredBodyId) : selectedBody;
  const activeMeshIds = activeBody ? activeBody.meshIds?.length ? activeBody.meshIds : [activeBody.meshId] : null;
  const indicatorScale = modelIndicatorScale(selectedLink.dimensions);

  const mergeSelected = () => {
    if (selectedBodyIds.length < 2) return;
    mergePhysicalBodies(selectedLink.id, selectedBodyIds);
    setSelectedBodyIds([]);
    setSelectedBodyId(null);
  };

  const toggleTreeSelection = (bodyId: string) => {
    setSelectedBodyIds((current) =>
      current.includes(bodyId) ? current.filter((id) => id !== bodyId) : [...current, bodyId],
    );
  };

  return (
    <main className="physical-grid">
      <aside className="tree-panel">
        <div className="panel-heading">
          <span>Physical tree</span>
          <GitBranch size={18} />
        </div>
        <label className="step-select">
          <span>STEP file</span>
          <select value={selectedLink.id} onChange={(event) => setSelectedLink(event.target.value)}>
            {links.map((link) => (
              <option key={link.id} value={link.id}>
                {link.name}
              </option>
            ))}
          </select>
        </label>

        <div className="tree-shell">
          <div className="tree-root">
            <Box size={15} />
            <div>
              <strong>{selectedLink.name}</strong>
              <p>{physicalBodies.length} body node{physicalBodies.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <div className="tree-children">
            {physicalBodies.length === 0 ? (
              <p className="muted">No sub-bodies are currently available.</p>
            ) : (
              physicalBodies.map((body, index) => (
                <button
                  key={body.id}
                  type="button"
                  className={[
                    "tree-body",
                    selectedBodyId === body.id ? "selected" : "",
                    hoveredBodyId === body.id ? "hovered" : "",
                    !body.enabled ? "muted-row" : "",
                  ].join(" ")}
                  onClick={() => setSelectedBodyId(body.id)}
                  onMouseEnter={() => setHoveredBodyId(body.id)}
                  onMouseLeave={() => setHoveredBodyId((current) => (current === body.id ? null : current))}
                >
                  <span className="tree-branch" />
                  <span className="tree-body-check">
                    <input
                      type="checkbox"
                      checked={selectedBodyIds.includes(body.id)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleTreeSelection(body.id)}
                    />
                  </span>
                  <div className="tree-body-copy">
                    <strong>{body.name || `Sub-body ${index + 1}`}</strong>
                    <p>{body.meshIds?.length && body.meshIds.length > 1 ? `Merged from ${body.meshIds.length} bodies` : body.meshId}</p>
                  </div>
                  <span className={body.enabled ? "tree-status ok" : "tree-status off"}>
                    {body.enabled ? "active" : "off"}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <section className="viewer-shell physical-viewer">
        <div className="viewer-toolbar compact">
          <div>
            <h2>{selectedLink.name}</h2>
            <p>Hover a body in the tree to isolate it, or select several bodies to merge them.</p>
          </div>
        </div>
        <div className="canvas-wrap tall">
          <Canvas shadows>
            <PerspectiveCamera makeDefault position={[2.4, 2, 2.2]} fov={42} />
            <ambientLight intensity={0.55} />
            <directionalLight castShadow position={[3, 4, 5]} intensity={1.8} />
            <Environment preset="city" />
            <Grid args={[8, 8]} cellSize={0.5} sectionSize={1} fadeDistance={8} position={[0, -0.55, 0]} />
            <group>
              <LinkMesh
                link={selectedLink}
                activeMeshIds={activeMeshIds}
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

      <aside className="property-panel physical-panel">
        <div className="panel-heading">
          <span>Physical properties</span>
          <CircleDot size={18} />
        </div>

        <div className="summary-strip">
          <div className={["physics-badge", physicalValidation.valid ? "ok" : "bad"].join(" ")}>
            {physicalValidation.valid ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />}
            <span>{physicalValidation.badge}</span>
          </div>
          <div className="summary-line">
            <strong>Mass</strong>
            <span>{physicalSummary.totalMass.toFixed(4)} kg</span>
          </div>
          <div className="summary-line">
            <strong>CoM</strong>
            <span>[{physicalSummary.centerOfMass.map((value) => value.toFixed(4)).join(", ")}]</span>
          </div>
          <div className="summary-line">
            <strong>Inertia</strong>
            <span>{[physicalSummary.inertia.ixx, physicalSummary.inertia.iyy, physicalSummary.inertia.izz].map((value) => value.toExponential(2)).join(" / ")}</span>
          </div>
        </div>

        <div className="body-actions">
          <button type="button" className="secondary-button full" onClick={mergeSelected} disabled={selectedBodyIds.length < 2}>
            <Layers3 size={16} /> Merge selected bodies
          </button>
        </div>

        <div className="selected-body-card">
          <div className="selected-body-head">
            <div>
              <span>Selected body</span>
              <strong>{selectedBody?.name ?? "none"}</strong>
            </div>
            {selectedBody && (
              <label className="mini-toggle">
                <input
                  type="checkbox"
                  checked={selectedBody.enabled}
                  onChange={(event) => updatePhysicalBody(selectedLink.id, selectedBody.id, { enabled: event.target.checked })}
                />
                <span>Included</span>
              </label>
            )}
          </div>
          {selectedBody ? (
            <div className="selected-body-body">
              <div className="mode-tabs" role="tablist" aria-label="Mass mode">
                <button
                  type="button"
                  className={selectedBody.massMode === "density" ? "mode-tab active" : "mode-tab"}
                  onClick={() =>
                    updatePhysicalBody(selectedLink.id, selectedBody.id, { massMode: "density", manualMass: null })
                  }
                >
                  Density
                </button>
                <button
                  type="button"
                  className={selectedBody.massMode === "manual" ? "mode-tab active" : "mode-tab"}
                  onClick={() => updatePhysicalBody(selectedLink.id, selectedBody.id, { massMode: "manual" })}
                >
                  Manual
                </button>
              </div>
              {selectedBody.massMode === "density" ? (
                <div className="stacked-fields">
                  <label>
                    Material
                    <select
                      value={selectedBody.materialName}
                      onChange={(event) => {
                        const nextName = event.target.value as PhysicalMaterialName;
                        const preset = materialPresets.find((entry) => entry.name === nextName);
                        updatePhysicalBody(selectedLink.id, selectedBody.id, {
                          materialName: nextName,
                          density: preset?.density ?? selectedBody.density,
                          massMode: "density",
                        });
                      }}
                    >
                      {materialPresets.map((preset) => (
                        <option key={preset.name} value={preset.name}>
                          {preset.name}
                        </option>
                      ))}
                      <option value="Custom">Custom</option>
                    </select>
                  </label>
                  <label>
                    Density kg/m3
                    <input
                      type="number"
                      min={1}
                      step={10}
                      value={Number(selectedBody.density.toFixed(3))}
                      onChange={(event) =>
                        updatePhysicalBody(selectedLink.id, selectedBody.id, {
                          density: Number(event.target.value),
                          materialName: "Custom",
                        })
                      }
                    />
                  </label>
                </div>
              ) : (
                <label>
                  Override mass kg
                  <input
                    type="number"
                    min={0.001}
                    step={0.001}
                    value={Number((selectedBody.manualMass ?? 0).toFixed(4))}
                    onChange={(event) =>
                      updatePhysicalBody(selectedLink.id, selectedBody.id, {
                        manualMass: Number(event.target.value),
                      })
                    }
                  />
                </label>
              )}
            </div>
          ) : (
            <p className="muted">Select a body from the tree to edit it.</p>
          )}
        </div>

        <button type="button" className="primary-button full" onClick={() => setPage("assembly")}>
          Robot assembly <ArrowRight size={17} />
        </button>
      </aside>
    </main>
  );
}
