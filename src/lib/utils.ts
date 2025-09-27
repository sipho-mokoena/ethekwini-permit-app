import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function isValidPhoneNumber(phone: string): boolean {
  // South African phone number validation
  const phoneRegex = /^(\+27|0)[6-8][0-9]{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
}

export function formatPhoneNumber(phone: string): string {
  // Format to +27 format
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.startsWith("0")) {
    return "+27" + cleaned.slice(1);
  }
  if (cleaned.startsWith("+27")) {
    return cleaned;
  }
  return "+27" + cleaned;
}

export function compressImage(
  file: File,
  maxSizeMB: number = 2,
): Promise<File> {
  return new Promise((resolve) => {
    if (
      !file.type.startsWith("image/") ||
      file.size <= maxSizeMB * 1024 * 1024
    ) {
      resolve(file);
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      const maxWidth = 1920;
      const maxHeight = 1080;
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
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
}
