import { AssemblyPage } from "./components/AssemblyPage";
import { DefinitionPage } from "./components/DefinitionPage";
import { ExportPage } from "./components/ExportPage";
import { TopNav } from "./components/TopNav";
import { UploadPage } from "./components/UploadPage";
import { useAppStore } from "./store";

export default function App() {
  const page = useAppStore((state) => state.page);

  return (
    <div className="app-shell">
      <TopNav />
      {page === "upload" && <UploadPage />}
      {page === "definition" && <DefinitionPage />}
      {page === "assembly" && <AssemblyPage />}
      {page === "export" && <ExportPage />}
    </div>
  );
}
