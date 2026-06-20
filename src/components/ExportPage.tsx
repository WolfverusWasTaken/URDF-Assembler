import { Download, PackageCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { createCleanUrdf, createRobotPackageZip } from "../lib/packageExporter";
import { useAppStore } from "../store";

const materials = [
  { name: "PLA", density: 1240 },
  { name: "Aluminum", density: 2700 },
  { name: "Steel", density: 7850 },
  { name: "Titanium", density: 4430 },
  { name: "Custom", density: 1000 },
];

export function ExportPage() {
  const links = useAppStore((state) => state.links);
  const joints = useAppStore((state) => state.joints);
  const setPage = useAppStore((state) => state.setPage);
  const setLinkMaterial = useAppStore((state) => state.setLinkMaterial);
  const [includeMoveIt, setIncludeMoveIt] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const readyLinks = links.filter((link) => link.meshStatus === "ready").length;
  const urdfPreview = useMemo(() => createCleanUrdf(links, joints).slice(0, 2200), [links, joints]);

  const downloadPackage = async () => {
    setIsGenerating(true);
    try {
      const blob = await createRobotPackageZip({ links, joints, includeMoveIt });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "urdf_assembler_robot.zip";
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="export-layout">
      <section className="export-summary">
        <div className="panel-heading">
          <span>Export package</span>
          <PackageCheck size={18} />
        </div>
        <h2>Generated robot package</h2>
        <p>
          STEP files are converted to STL meshes. Origin offsets, default orientation, and link alignment are baked into
          mesh vertices so the URDF stays clean.
        </p>
        <div className="export-stats">
          <span>{links.length} links</span>
          <span>{joints.length} joints</span>
          <span>{readyLinks}/{links.length} STEP meshes ready</span>
        </div>
        <div className="material-list">
          {links.map((link) => (
            <div className="material-row" key={link.id}>
              <strong>{link.name}</strong>
              <label>
                Material
                <select
                  value={materials.some((material) => material.name === link.materialName) ? link.materialName : "Custom"}
                  onChange={(event) => {
                    const next = materials.find((material) => material.name === event.target.value);
                    if (!next) return;
                    setLinkMaterial(link.id, next.name, next.name === "Custom" ? link.density : next.density);
                  }}
                >
                  {materials.map((material) => (
                    <option key={material.name} value={material.name}>
                      {material.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Density kg/m3
                <input
                  type="number"
                  min={1}
                  step={10}
                  value={Number(link.density.toFixed(3))}
                  onChange={(event) => {
                    const density = Number(event.target.value);
                    setLinkMaterial(link.id, link.materialName === "Custom" ? "Custom" : `${link.materialName} custom`, density);
                  }}
                />
              </label>
              <span>
                Mass {link.mass.toFixed(4)} kg · Volume {link.volume.toExponential(3)} m3
              </span>
              <span>
                COM [{link.centerOfMass.map((value) => value.toFixed(4)).join(", ")}]
              </span>
            </div>
          ))}
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={includeMoveIt} onChange={(event) => setIncludeMoveIt(event.target.checked)} />
          <span>Include MoveIt configuration files</span>
        </label>
        <div className="export-actions">
          <button type="button" className="secondary-button" onClick={() => setPage("assembly")}>
            Back to assembly
          </button>
          <button type="button" className="primary-button" onClick={downloadPackage} disabled={links.length === 0 || isGenerating}>
            <Download size={16} /> {isGenerating ? "Generating..." : "Download package"}
          </button>
        </div>
      </section>

      <section className="export-preview">
        <div className="panel-heading">
          <span>URDF preview</span>
          <strong>minimal visual offsets</strong>
        </div>
        <pre>{urdfPreview}</pre>
      </section>
    </main>
  );
}
