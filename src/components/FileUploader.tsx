import React, { useState, useRef } from 'react'
import { Upload, X, FileText, Image } from 'lucide-react'
import { Button } from './ui/Button'
import { Progress } from './ui/Progress'
import { cn, formatFileSize } from '../lib/utils'

interface FileUploadItem {
  file: File
  progress: number
  uploaded: boolean
  error?: string
  fileId?: string
  preview?: string
}

interface FileUploaderProps {
  onFilesUploaded: (files: { fileId: string; filename: string; documentType: string }[]) => void
  maxFiles?: number
  maxFileSize?: number // in bytes
  acceptedTypes?: string[]
  documentType: string
  className?: string
}

export function FileUploader({
  onFilesUploaded,
  maxFiles = 5,
  maxFileSize = 8 * 1024 * 1024, // 8MB
  acceptedTypes = ['image/*', 'application/pdf'],
  documentType,
  className
}: FileUploaderProps) {
  const [files, setFiles] = useState<FileUploadItem[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const compressImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/') || file.size <= 2 * 1024 * 1024) {
      return file
    }

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions
        const maxWidth = 1920
        const maxHeight = 1080
        let { width, height } = img

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              })
              resolve(compressedFile)
            } else {
              resolve(file)
            }
          },
          file.type,
          0.8
        )
      }

      img.src = URL.createObjectURL(file)
    })
  }

  const createPreview = (file: File): string | undefined => {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file)
    }
    return undefined
  }

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size must be less than ${formatFileSize(maxFileSize)}`
    }

    const isValidType = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1))
      }
      return file.type === type
    })

    if (!isValidType) {
      return `File type not supported. Accepted types: ${acceptedTypes.join(', ')}`
    }

    return null
  }

  const handleFiles = async (fileList: FileList) => {
    const newFiles: FileUploadItem[] = []

    for (let i = 0; i < fileList.length && files.length + newFiles.length < maxFiles; i++) {
      const file = fileList[i]
      const error = validateFile(file)

      if (error) {
        newFiles.push({
          file,
          progress: 0,
          uploaded: false,
          error
        })
      } else {
        const compressedFile = await compressImage(file)
        const preview = createPreview(compressedFile)

        newFiles.push({
          file: compressedFile,
          progress: 0,
          uploaded: false,
          preview
        })
      }
    }

    setFiles(prev => [...prev, ...newFiles])
  }

  const uploadFile = async (index: number) => {
    const fileItem = files[index]
    if (fileItem.uploaded || fileItem.error) return

    try {
      const { backend } = await import('../lib/backend')
      const currentUser = await backend.auth.getCurrentUser()
      
      if (!currentUser) {
        throw new Error('Not authenticated')
      }

      const result = await backend.storage.uploadFile(
        fileItem.file,
        currentUser.id,
        {
          filename: fileItem.file.name,
          documentType,
          progress: (progress) => {
            setFiles(prev => prev.map((f, i) => 
              i === index ? { ...f, progress } : f
            ))
          }
        }
      )

      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, uploaded: true, fileId: result.fileId, progress: 100 } : f
      ))

      // Notify parent of successful upload
      const uploadedFiles = files
        .map((f, i) => i === index ? { ...f, uploaded: true, fileId: result.fileId } : f)
        .filter(f => f.uploaded && f.fileId)
        .map(f => ({
          fileId: f.fileId!,
          filename: f.file.name,
          documentType
        }))

      onFilesUploaded(uploadedFiles)

    } catch (error) {
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, error: error instanceof Error ? error.message : 'Upload failed' } : f
      ))
    }
  }

  const removeFile = (index: number) => {
    const fileItem = files[index]
    if (fileItem.preview) {
      URL.revokeObjectURL(fileItem.preview)
    }
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          files.length >= maxFiles && "opacity-50 pointer-events-none"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-2">
          Drop files here or click to browse
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          {acceptedTypes.join(', ')} up to {formatFileSize(maxFileSize)}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={files.length >= maxFiles}
        >
          Choose Files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((fileItem, index) => (
            <div
              key={index}
              className="flex items-center space-x-3 p-3 border rounded-lg"
            >
              <div className="flex-shrink-0">
                {fileItem.preview ? (
                  <img
                    src={fileItem.preview}
                    alt={fileItem.file.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : fileItem.file.type.startsWith('image/') ? (
                  <Image className="w-12 h-12 text-muted-foreground" />
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
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}