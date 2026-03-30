import { useCallback, useEffect, useRef, useState } from "react";
import { UploadedFile } from "../types/nids";

interface UseFileUploadOptions {
  initialFiles?: UploadedFile[];
  onAccept?: (file: File) => void;
  onError?: (title: string, message: string) => void;
}

const allowedExtensions = [".pcap", ".pcapng"];
const maxFileSize = 100 * 1024 * 1024;

export const useFileUpload = ({
  initialFiles = [],
  onAccept,
  onError
}: UseFileUploadOptions) => {
  const [files, setFiles] = useState<UploadedFile[]>(initialFiles);
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const clearTimer = useCallback((id: string) => {
    if (timers.current[id]) {
      clearInterval(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const simulateUpload = useCallback(
    (queuedFile: UploadedFile) => {
      timers.current[queuedFile.id] = setInterval(() => {
        setFiles((current) =>
          current.map((file) => {
            if (file.id !== queuedFile.id) return file;

            const nextProgress = Math.min(file.progress + Math.floor(Math.random() * 18) + 10, 100);
            if (nextProgress >= 100) {
              clearTimer(file.id);
              return {
                ...file,
                progress: 100,
                status: "ready"
              };
            }

            return {
              ...file,
              progress: nextProgress,
              status: nextProgress > 70 ? "analyzing" : "uploading"
            };
          })
        );
      }, 220);
    },
    [clearTimer]
  );

  const queueFiles = useCallback(
    (incoming: FileList | File[]) => {
      Array.from(incoming).forEach((file) => {
        const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
        if (!allowedExtensions.includes(extension)) {
          onError?.("Unsupported file type", `${file.name} is not a .pcap or .pcapng capture file.`);
          return;
        }

        if (file.size > maxFileSize) {
          onError?.(
            "File too large",
            `${file.name} exceeds the 100 MB upload limit configured for this UI demo.`
          );
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
        simulateUpload(queuedFile);
        onAccept?.(file);
      });
    },
    [onAccept, onError, simulateUpload]
  );

  useEffect(
    () => () => {
      Object.keys(timers.current).forEach(clearTimer);
    },
    [clearTimer]
  );

  return {
    files,
    queueFiles
  };
};
