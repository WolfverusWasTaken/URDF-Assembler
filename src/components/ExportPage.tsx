import { CheckCircle2, Download, PackageCheck, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { createCleanUrdf, createRobotPackageZip, validateRobotLink } from "../lib/packageExporter";
import { useAppStore } from "../store";

export function ExportPage() {
  const links = useAppStore((state) => state.links);
  const joints = useAppStore((state) => state.joints);
  const setPage = useAppStore((state) => state.setPage);
  const [includeMoveIt, setIncludeMoveIt] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const validationResults = useMemo(
    () =>
      links.map((link) => {
        const { summary, validation } = validateRobotLink(link);
        const ready = link.meshStatus === "ready" && summary.bodies.length > 0;
        const valid = validation.valid && ready;
        const errors = [
          ...validation.errors,
          ...(link.meshStatus === "ready" ? [] : ["STEP mesh is not ready yet."]),
          ...(summary.bodies.length > 0 ? [] : ["No physical sub-bodies were detected."]),
        ].filter(Boolean);

        return { link, summary, valid, errors };
      }),
    [links],
  );
  const allValid = validationResults.length > 0 && validationResults.every((entry) => entry.valid);
  const successfulCount = validationResults.filter((entry) => entry.valid).length;
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
          <span>Export gate</span>
          <PackageCheck size={18} />
        </div>
        <h2>Generated robot package</h2>
        <p>
          STEP files are converted to STL meshes, baked with their offsets, and checked for physically valid inertial
          data before download is enabled.
        </p>
        <div className="export-stats">
          <span>{links.length} links</span>
          <span>{joints.length} joints</span>
          <span>{successfulCount}/{links.length} physics checks passed</span>
        </div>
        <div className={["physics-badge", allValid ? "ok" : "bad"].join(" ")}>
          {allValid ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />}
          <span>{allValid ? "Physics Engine Verification Passed" : "Needs review before export"}</span>
        </div>
        <div className="export-validation-list">
          {validationResults.map((entry) => (
            <div key={entry.link.id} className={["export-validation-row", entry.valid ? "ok" : "bad"].join(" ")}>
              <div className="export-validation-head">
                <strong>{entry.link.name}</strong>
                <span>{entry.valid ? "Verified" : "Blocked"}</span>
              </div>
              <p>
                Mass {entry.summary.totalMass.toFixed(4)} kg · CoM [{entry.summary.centerOfMass.map((value) => value.toFixed(4)).join(", ")}]
              </p>
              {!entry.valid && (
                <div className="warning-box">
                  {entry.errors.map((error) => (
                    <span key={error}>{error}</span>
                  ))}
                </div>
              )}
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
          <button
            type="button"
            className="primary-button"
            onClick={downloadPackage}
            disabled={links.length === 0 || isGenerating || !allValid}
          >
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
