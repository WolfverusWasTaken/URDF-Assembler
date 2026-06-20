import { Clipboard, Download } from "lucide-react";
import { useMemo, useState } from "react";
import {
  generateMjcf,
  generateMoveItPackage,
  generatePyBullet,
  generateSdf,
  generateSrdf,
  generateUrdf,
  generateUsd,
} from "../lib/exporters";
import { useAppStore } from "../store";

const formats = ["URDF", "SRDF", "MoveIt", "MJCF", "SDF", "PyBullet", "Isaac USD"] as const;
type ExportFormat = (typeof formats)[number];

export function ExportPanel() {
  const [format, setFormat] = useState<ExportFormat>("URDF");
  const links = useAppStore((state) => state.links);
  const joints = useAppStore((state) => state.joints);

  const output = useMemo(() => {
    switch (format) {
      case "SRDF":
        return generateSrdf(links);
      case "MoveIt":
        return generateMoveItPackage(links, joints);
      case "MJCF":
        return generateMjcf(links, joints);
      case "SDF":
        return generateSdf(links, joints);
      case "PyBullet":
        return generatePyBullet();
      case "Isaac USD":
        return generateUsd(links);
      default:
        return generateUrdf(links, joints);
    }
  }, [format, joints, links]);

  const extension = format === "PyBullet" ? "py" : format === "Isaac USD" ? "usda" : format.toLowerCase().replace("moveit", "txt");

  const download = () => {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `urdf_assembler_robot.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="export-panel">
      <div className="panel-heading">
        <span>Export</span>
        <Download size={17} />
      </div>
      <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
        {formats.map((item) => <option key={item}>{item}</option>)}
      </select>
      <pre>{output.slice(0, 1400)}</pre>
      <div className="export-actions">
        <button type="button" className="secondary-button" onClick={() => navigator.clipboard.writeText(output)}>
          <Clipboard size={16} /> Copy
        </button>
        <button type="button" className="primary-button" onClick={download}>
          <Download size={16} /> Download
        </button>
      </div>
    </section>
  );
}
