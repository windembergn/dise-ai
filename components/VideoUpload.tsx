'use client'

import { useCallback, useState, useRef } from 'react'
import { Upload, Video, X, FileVideo } from 'lucide-react'

interface VideoUploadProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
  selectedFile: File | null
  onClear: () => void
}

export default function VideoUpload({
  onFileSelect,
  disabled,
  selectedFile,
  onClear
}: VideoUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('video/')) {
        onFileSelect(file)
      }
    }
  }, [disabled, onFileSelect])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onFileSelect(files[0])
    }
  }, [onFileSelect])

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click()
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (selectedFile) {
    return (
      <div className="card-medical">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-600">Video Selecionado</h3>
          <button
            onClick={onClear}
            disabled={disabled}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Remover video"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
          <div className="p-3 bg-blue-100 rounded-xl">
            <FileVideo className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 truncate">
              {selectedFile.name}
            </p>
            <p className="text-sm text-slate-500">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`upload-zone ${isDragging ? 'upload-zone-active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-msvideo,video/*"
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />

      <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-slate-100'} transition-colors`}>
        {isDragging ? (
          <Video className="w-8 h-8 text-blue-600" />
        ) : (
          <Upload className="w-8 h-8 text-slate-400" />
        )}
      </div>

      <div className="text-center">
        <p className="font-medium text-slate-700">
          {isDragging ? 'Solte o video aqui' : 'Arraste o video ou clique para selecionar'}
        </p>
        <p className="text-sm text-slate-500 mt-1">
          MP4, MOV, AVI - Arquivos grandes serão otimizados automaticamente
        </p>
      </div>
    </div>
  )
}
