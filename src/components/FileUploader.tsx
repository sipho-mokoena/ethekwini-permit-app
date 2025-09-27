import { FileText, Image as ImageIcon, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { backend } from "../lib/backend";
import { cn, formatFileSize } from "../lib/utils";
import { Button } from "./ui/Button";
import { Progress } from "./ui/Progress";

interface FileUploadItem {
  file: File;
  progress: number;
  uploaded: boolean;
  error?: string;
  fileId?: string;
  preview?: string;
}

interface FileUploaderProps {
  onFilesUploaded: (
    files: { fileId: string; filename: string; documentType: string }[],
  ) => void;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  acceptedTypes?: string[];
  documentType: string;
  className?: string;
}

export function FileUploader({
  onFilesUploaded,
  maxFiles = 5,
  maxFileSize = 8 * 1024 * 1024,
  acceptedTypes = ["image/*", "application/pdf"],
  documentType,
  className,
}: FileUploaderProps) {
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<FileUploadItem[]>([]);
  const inputId = useId();

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => {
        if (item.preview) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, []);

  const compressImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith("image/") || file.size <= 2 * 1024 * 1024) {
      return file;
    }

    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new window.Image();

      img.onload = () => {
        if (!ctx) {
          resolve(file);
          return;
        }

        const maxWidth = 1920;
        const maxHeight = 1080;
        let { width, height } = img;

        if (width > height && width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        } else if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(
                new File([blob], file.name, {
                  type: file.type,
                  lastModified: Date.now(),
                }),
              );
            } else {
              resolve(file);
            }
          },
          file.type,
          0.8,
        );
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const createPreview = (file: File): string | undefined => {
    return file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
  };

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size must be less than ${formatFileSize(maxFileSize)}`;
    }

    const isValidType = acceptedTypes.some((type) => {
      if (type.endsWith("/*")) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isValidType) {
      return `File type not supported. Accepted types: ${acceptedTypes.join(", ")}`;
    }

    return null;
  };

  const handleFiles = async (fileList: FileList) => {
    const newItems: FileUploadItem[] = [];

    for (
      let i = 0;
      i < fileList.length && files.length + newItems.length < maxFiles;
      i++
    ) {
      const file = fileList[i];
      const error = validateFile(file);

      if (error) {
        newItems.push({ file, progress: 0, uploaded: false, error });
        continue;
      }

      const compressed = await compressImage(file);
      newItems.push({
        file: compressed,
        progress: 0,
        uploaded: false,
        preview: createPreview(compressed),
      });
    }

    if (newItems.length > 0) {
      setFiles((prev) => [...prev, ...newItems]);
    }
  };

  const uploadFile = async (index: number) => {
    const fileItem = files[index];
    if (!fileItem || fileItem.uploaded || fileItem.error) return;

    try {
      const currentUser = await backend.auth.getCurrentUser();

      if (!currentUser) {
        throw new Error("Not authenticated");
      }

      const result = await backend.storage.uploadFile(
        fileItem.file,
        currentUser.id,
        {
          filename: fileItem.file.name,
          documentType,
          progress: (progress) => {
            setFiles((prev) =>
              prev.map((item, idx) =>
                idx === index ? { ...item, progress } : item,
              ),
            );
          },
        },
      );

      setFiles((prev) => {
        const next = prev.map((item, idx) =>
          idx === index
            ? { ...item, uploaded: true, fileId: result.fileId, progress: 100 }
            : item,
        );

        const uploadedItems = next
          .filter((item) => item.uploaded && item.fileId)
          .map((item) => ({
            fileId: item.fileId as string,
            filename: item.file.name,
            documentType,
          }));

        onFilesUploaded(uploadedItems);
        return next;
      });
    } catch (error) {
      setFiles((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? {
                ...item,
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : item,
        ),
      );
    }
  };

  const removeFile = (index: number) => {
    const fileItem = files[index];
    if (fileItem?.preview) {
      URL.revokeObjectURL(fileItem.preview);
    }

    setFiles((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      const uploadedItems = next
        .filter((item) => item.uploaded && item.fileId)
        .map((item) => ({
          fileId: item.fileId as string,
          filename: item.file.name,
          documentType,
        }));

      onFilesUploaded(uploadedItems);
      return next;
    });
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (files.length >= maxFiles) return;
    handleFiles(event.dataTransfer.files);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      handleFiles(event.target.files);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <label
        htmlFor={inputId}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25",
          files.length >= maxFiles && "opacity-50 cursor-not-allowed",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={(event) => {
          if (files.length >= maxFiles) {
            event.preventDefault();
          }
        }}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && files.length < maxFiles) {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-disabled={files.length >= maxFiles}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-2">
          Drop files here or click to browse
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          {acceptedTypes.join(", ")} up to {formatFileSize(maxFileSize)}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={files.length >= maxFiles}
        >
          Choose Files
        </Button>
      </label>

      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(",")}
        onChange={handleFileSelect}
        className="hidden"
      />

      {files.length > 0 ? (
        <div className="space-y-3">
          {files.map((fileItem, index) => (
            <div
              key={fileItem.fileId ?? `${fileItem.file.name}-${index}`}
              className="flex items-center space-x-3 p-3 border rounded-lg"
            >
              <div className="flex-shrink-0">
                {fileItem.preview ? (
                  <div
                    className="w-12 h-12 rounded bg-cover bg-center"
                    style={{ backgroundImage: `url(${fileItem.preview})` }}
                  />
                ) : fileItem.file.type.startsWith("image/") ? (
                  <ImageIcon className="w-12 h-12 text-muted-foreground" />
                ) : (
                  <FileText className="w-12 h-12 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {fileItem.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(fileItem.file.size)}
                </p>

                {fileItem.error ? (
                  <p className="text-xs text-destructive mt-1">
                    {fileItem.error}
                  </p>
                ) : fileItem.uploaded ? (
                  <p className="text-xs text-green-600 mt-1">
                    Uploaded successfully
                  </p>
                ) : fileItem.progress > 0 ? (
                  <div className="mt-2">
                    <Progress value={fileItem.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {fileItem.progress}% uploaded
                    </p>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => uploadFile(index)}
                    className="mt-2"
                  >
                    Upload
                  </Button>
                )}
              </div>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeFile(index)}
                aria-label={`Remove ${fileItem.file.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
