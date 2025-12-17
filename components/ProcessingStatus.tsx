'use client'

import { Loader2, Upload, Cpu, CheckCircle, AlertCircle, Cog } from 'lucide-react'
import type { UploadStatus, UploadProgress } from '@/lib/types'

interface ProcessingStatusProps {
  status: UploadStatus
  error?: string
  uploadProgress?: UploadProgress
}

const statusConfig = {
  idle: {
    icon: Upload,
    text: 'Aguardando vídeo',
    color: 'text-slate-400',
    bgColor: 'bg-slate-100',
    barColor: 'bg-slate-400',
  },
  uploading: {
    icon: Loader2,
    text: 'Enviando vídeo...',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    barColor: 'bg-blue-500',
    animate: true,
  },
  processing: {
    icon: Cog,
    text: 'Processando vídeo...',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    barColor: 'bg-amber-500',
    animate: true,
  },
  analyzing: {
    icon: Cpu,
    text: 'Analisando obstrução...',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    barColor: 'bg-purple-500',
    animate: true,
  },
  complete: {
    icon: CheckCircle,
    text: 'Análise concluída!',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    barColor: 'bg-green-500',
  },
  error: {
    icon: AlertCircle,
    text: 'Erro na análise',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    barColor: 'bg-red-500',
  },
}

function formatTimeRemaining(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return ''

  if (seconds < 60) {
    return `~${Math.ceil(seconds)}s restantes`
  } else {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.ceil(seconds % 60)
    if (secs === 0) {
      return `~${minutes}min restantes`
    }
    return `~${minutes}min ${secs}s restantes`
  }
}

export default function ProcessingStatus({ status, error, uploadProgress }: ProcessingStatusProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  if (status === 'idle') return null

  // Usar mensagem do progresso se disponível
  const displayText = uploadProgress?.message || config.text
  const progress = uploadProgress?.progress ?? 0
  const timeRemaining = formatTimeRemaining(uploadProgress?.estimatedTimeRemaining)

  const isProcessing = status === 'uploading' || status === 'processing' || status === 'analyzing'

  return (
    <div className="card-medical">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${config.bgColor}`}>
          <Icon
            className={`w-6 h-6 ${config.color} ${'animate' in config && config.animate ? 'animate-spin' : ''}`}
          />
        </div>
        <div className="flex-1">
          <p className={`font-medium ${config.color}`}>{displayText}</p>
          {error && status === 'error' && (
            <p className="text-sm text-red-500 mt-1">{error}</p>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="mt-4 space-y-2">
          {/* Barra de progresso */}
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${config.barColor} transition-all duration-500 ease-out`}
              style={{ width: `${Math.max(progress, 2)}%` }}
            />
          </div>

          {/* Progresso e tempo restante */}
          <div className="flex justify-between items-center text-sm">
            <span className={`font-medium ${config.color}`}>
              {progress.toFixed(0)}%
            </span>
            {timeRemaining && (
              <span className="text-slate-500">
                {timeRemaining}
              </span>
            )}
          </div>
        </div>
      )}

      {status === 'complete' && (
        <div className="mt-4">
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-green-500 w-full" />
          </div>
          <div className="flex justify-between items-center text-sm mt-2">
            <span className="font-medium text-green-600">100%</span>
            <span className="text-green-600">Concluído!</span>
          </div>
        </div>
      )}
    </div>
  )
}
