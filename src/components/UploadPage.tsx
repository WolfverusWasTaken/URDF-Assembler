import { FileUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { collectDroppedFiles, formatFileSize } from "../lib/files";
import { useAppStore } from "../store";

export function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const links = useAppStore((state) => state.links);
  const addFiles = useAppStore((state) => state.addFiles);
  const removeLink = useAppStore((state) => state.removeLink);
  const setPage = useAppStore((state) => state.setPage);

  const handleFiles = (files: File[]) => {
    addFiles(files);
  };

  return (
    <main className="upload-layout">
      <section
        className={`drop-zone ${isDragging ? "drop-zone-active" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void collectDroppedFiles(event.dataTransfer).then(handleFiles);
        }}
      >
        <div className="upload-icon">
          <FileUp size={34} />
        </div>
        <h2>Drop STEP files here</h2>
        <p>Drag STEP or STP files from any local folder. Each file becomes one robot link.</p>
        <button type="button" className="primary-button" onClick={() => inputRef.current?.click()}>
          Choose files
        </button>
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept=".step,.stp"
          multiple
          onChange={(event) => handleFiles(Array.from(event.target.files ?? []))}
        />
      </section>

      <aside className="intake-panel">
        <div className="panel-heading">
          <span>Loaded links</span>
          <strong>{links.length}</strong>
        </div>
        <div className="file-list">
          {links.length === 0 ? (
            <div className="empty-state">No parts loaded yet.</div>
          ) : (
            links.map((link, index) => (
              <div className="file-row" key={link.id}>
                <span className="file-index">{index + 1}</span>
                <div>
                  <strong>{link.name}</strong>
                  <p>
                    {formatFileSize(link.fileSize)} - {statusText(link.meshStatus, link.meshError)} - mass {link.mass} kg
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => removeLink(link.id)}
                  aria-label={`Remove ${link.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
        <button type="button" className="primary-button full" disabled={links.length === 0} onClick={() => setPage("definition")}>
          Define connection points
        </button>
      </aside>
    </main>
  );
}

function statusText(status: string, error?: string) {
  if (status === "ready") return "STEP mesh ready";
  if (status === "parsing") return "parsing STEP";
  if (status === "failed") return error || "STEP parse failed";
  return "queued";
}
