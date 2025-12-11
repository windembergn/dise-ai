'use client'

import { Loader2, Upload, Cpu, CheckCircle, AlertCircle } from 'lucide-react'
import type { UploadStatus } from '@/lib/types'

interface ProcessingStatusProps {
  status: UploadStatus
  error?: string
}

const statusConfig = {
  idle: {
    icon: Upload,
    text: 'Aguardando vídeo',
    color: 'text-slate-400',
    bgColor: 'bg-slate-100',
  },
  uploading: {
    icon: Loader2,
    text: 'Enviando vídeo...',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    animate: true,
  },
  processing: {
    icon: Loader2,
    text: 'Processando vídeo...',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    animate: true,
  },
  analyzing: {
    icon: Cpu,
    text: 'Analisando obstrução...',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    animate: true,
  },
  complete: {
    icon: CheckCircle,
    text: 'Análise concluída!',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  error: {
    icon: AlertCircle,
    text: 'Erro na análise',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
}

export default function ProcessingStatus({ status, error }: ProcessingStatusProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  if (status === 'idle') return null

  return (
    <div className="card-medical">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${config.bgColor}`}>
          <Icon
            className={`w-6 h-6 ${config.color} ${'animate' in config && config.animate ? 'animate-spin' : ''}`}
          />
        </div>
        <div className="flex-1">
          <p className={`font-medium ${config.color}`}>{config.text}</p>
          {error && status === 'error' && (
            <p className="text-sm text-red-500 mt-1">{error}</p>
          )}
        </div>
      </div>

      {(status === 'uploading' || status === 'processing' || status === 'analyzing') && (
        <div className="mt-4">
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                status === 'uploading' ? 'bg-blue-500' :
                status === 'processing' ? 'bg-amber-500' : 'bg-purple-500'
              } animate-pulse`}
              style={{
                width: status === 'uploading' ? '30%' :
                       status === 'processing' ? '60%' : '90%'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
