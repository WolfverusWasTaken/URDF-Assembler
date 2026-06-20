import { Boxes, Download, MousePointer2, PackageCheck } from "lucide-react";
import type { PageKey } from "../types";
import { useAppStore } from "../store";

const pages: Array<{ key: PageKey; label: string; icon: typeof Download }> = [
  { key: "upload", label: "STEP Intake", icon: Download },
  { key: "definition", label: "Link Definition", icon: MousePointer2 },
  { key: "assembly", label: "Robot Assembly", icon: Boxes },
  { key: "export", label: "Export Package", icon: PackageCheck },
];

export function TopNav() {
  const page = useAppStore((state) => state.page);
  const links = useAppStore((state) => state.links);
  const setPage = useAppStore((state) => state.setPage);

  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-mark">UA</div>
        <div>
          <h1>URDF Assembler</h1>
          <p>Visual STEP-to-robot builder</p>
        </div>
      </div>
      <nav className="page-tabs">
        {pages.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={page === key ? "tab tab-active" : "tab"}
            onClick={() => setPage(key)}
            disabled={key !== "upload" && links.length === 0}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
