interface DroppedFileEntry {
  isFile: boolean;
  isDirectory: boolean;
  file: (success: (file: File) => void, failure?: (error: DOMException) => void) => void;
}

interface DroppedDirectoryEntry {
  isFile: boolean;
  isDirectory: boolean;
  createReader: () => {
    readEntries: (
      success: (entries: Array<DroppedEntry>) => void,
      failure?: (error: DOMException) => void,
    ) => void;
  };
}

type DroppedEntry = DroppedFileEntry | DroppedDirectoryEntry;

interface EntryGetter {
  webkitGetAsEntry?: () => DroppedEntry | null;
}

const readFileEntry = (entry: DroppedFileEntry) =>
  new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });

const readDirectoryEntry = async (entry: DroppedDirectoryEntry): Promise<File[]> => {
  const reader = entry.createReader();
  const files: File[] = [];

  while (true) {
    const entries = await new Promise<Array<DroppedEntry>>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

    if (entries.length === 0) break;

    const nested = await Promise.all(entries.map(readDroppedEntry));
    files.push(...nested.flat());
  }

  return files;
};

const readDroppedEntry = async (entry: DroppedEntry): Promise<File[]> => {
  if (entry.isFile) return [await readFileEntry(entry as DroppedFileEntry)];
  if (entry.isDirectory) return readDirectoryEntry(entry as DroppedDirectoryEntry);
  return [];
};

export const collectDroppedFiles = async (dataTransfer: DataTransfer) => {
  const items = Array.from(dataTransfer.items ?? []);
  const entries = items
    .map((item) => (item as unknown as EntryGetter).webkitGetAsEntry?.())
    .filter((entry): entry is DroppedEntry => Boolean(entry));

  if (entries.length > 0) {
    const nested = await Promise.all(entries.map(readDroppedEntry));
    return nested.flat();
  }

  return Array.from(dataTransfer.files ?? []);
};

export const formatFileSize = (bytes: number) => {
  if (bytes <= 0) return "size unavailable";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
