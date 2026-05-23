import { useCallback, useState } from "react";
import { UploadedFile } from "../types/nids";

interface UseFileUploadOptions {
  initialFiles?: UploadedFile[];
  onAccept?: (file: File, queuedFile: UploadedFile) => void | Promise<void>;
  onError?: (title: string, message: string) => void;
}

const allowedExtensions = [".csv"];
const maxFileSize = 2048 * 1024 * 1024; // 2GB

export const useFileUpload = ({
  initialFiles = [],
  onAccept,
  onError
}: UseFileUploadOptions) => {
  const [files, setFiles] = useState<UploadedFile[]>(initialFiles);

  const updateFile = useCallback((id: string, updater: (file: UploadedFile) => UploadedFile) => {
    setFiles((current) => current.map((file) => (file.id === id ? updater(file) : file)));
  }, []);

  const setFileProgress = useCallback(
    (id: string, progress: number, status?: UploadedFile["status"]) => {
      updateFile(id, (file) => ({
        ...file,
        progress,
        status: status ?? file.status
      }));
    },
    [updateFile]
  );

  const markFileReady = useCallback(
    (id: string) => {
      updateFile(id, (file) => ({
        ...file,
        progress: 100,
        status: "ready"
      }));
    },
    [updateFile]
  );

  const markFileError = useCallback(
    (id: string) => {
      updateFile(id, (file) => ({
        ...file,
        status: "error"
      }));
    },
    [updateFile]
  );

  const queueFiles = useCallback(
    (incoming: FileList | File[]) => {
      Array.from(incoming).forEach((file) => {
        const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
        if (!allowedExtensions.includes(extension)) {
          onError?.("Unsupported file type", `${file.name} is not a .csv file.`);
          return;
        }

        if (file.size > maxFileSize) {
          onError?.("File too large", `${file.name} exceeds the 2 GB upload limit.`);
          return;
        }

        const queuedFile: UploadedFile = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: file.name,
          size: file.size,
          extension: extension.replace(".", ""),
          progress: 0,
          status: "uploading"
        };

        setFiles((current) => [queuedFile, ...current]);
        void onAccept?.(file, queuedFile);
      });
    },
    [onAccept, onError]
  );

  return {
    files,
    queueFiles,
    setFileProgress,
    markFileReady,
    markFileError
  };
};
