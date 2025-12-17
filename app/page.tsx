'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Stethoscope, Play, RefreshCw } from 'lucide-react'
import VideoUpload from '@/components/VideoUpload'
import ProcessingStatus from '@/components/ProcessingStatus'
import AnalysisResultComponent from '@/components/AnalysisResult'
import { analyzeVideo, analyzeVideoByUri } from './actions/analyze'
import type { AnalysisResult, UploadStatus, UploadProgress } from '@/lib/types'

// Limite para uso direto da Server Action (100MB)
const DIRECT_UPLOAD_LIMIT = 100 * 1024 * 1024

// Estimativas de tempo (em segundos) baseadas em execução real
// Upload 106MB: 42s → 0.4s/MB | Análise 106MB: 26s → base 25s
const TIME_ESTIMATES = {
  uploadPerMB: 0.4, // ~2.5MB/s de upload (medido: 42s para 106MB)
  processingPerMB: 0.02, // Tempo de processamento no Google AI
  analysisBase: 25, // Tempo base para análise com Gemini 2.5 Pro
  analysisPerMB: 0.02, // Tempo adicional por MB do vídeo
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string>('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: 'idle',
    progress: 0,
    message: ''
  })
  const abortControllerRef = useRef<AbortController | null>(null)
  const startTimeRef = useRef<number>(0)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Limpar interval quando componente desmontar
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file)
    setVideoUrl(URL.createObjectURL(file))
    setResult(null)
    setError('')
    setStatus('idle')
    setUploadProgress({ stage: 'idle', progress: 0, message: '' })
  }, [])

  const handleClear = useCallback(() => {
    // Cancelar upload em andamento
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    // Limpar interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
    }
    setSelectedFile(null)
    setVideoUrl(null)
    setResult(null)
    setError('')
    setStatus('idle')
    setUploadProgress({ stage: 'idle', progress: 0, message: '' })
  }, [videoUrl])

  // Função para calcular tempo estimado total
  const calculateTotalTime = (fileSizeMB: number): number => {
    const uploadTime = fileSizeMB * TIME_ESTIMATES.uploadPerMB
    const processingTime = fileSizeMB * TIME_ESTIMATES.processingPerMB
    const analysisTime = TIME_ESTIMATES.analysisBase + (fileSizeMB * TIME_ESTIMATES.analysisPerMB)
    return uploadTime + processingTime + analysisTime
  }

  // Função para simular progresso gradual
  const startProgressSimulation = (
    startProgress: number,
    endProgress: number,
    durationSeconds: number,
    stage: UploadProgress['stage'],
    message: string
  ) => {
    // Limpar interval anterior
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }

    const startTime = Date.now()
    const totalDuration = durationSeconds * 1000 // em ms

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progressRatio = Math.min(elapsed / totalDuration, 0.95) // Máximo 95% até confirmação
      const currentProgress = startProgress + (endProgress - startProgress) * progressRatio
      const remainingTime = Math.max(0, (totalDuration - elapsed) / 1000)

      setUploadProgress({
        stage,
        progress: Math.round(currentProgress),
        message,
        startTime: startTimeRef.current,
        estimatedTimeRemaining: Math.round(remainingTime)
      })

      // Parar quando atingir 95% (vai para 100% quando a operação realmente terminar)
      if (progressRatio >= 0.95) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }
      }
    }, 200)
  }

  const handleAnalyze = async () => {
    if (!selectedFile) return

    setError('')
    setResult(null)
    startTimeRef.current = Date.now()

    const isLargeFile = selectedFile.size > DIRECT_UPLOAD_LIMIT
    const fileSizeMB = selectedFile.size / (1024 * 1024)
    const fileSizeDisplay = fileSizeMB.toFixed(1)
    const totalEstimatedTime = calculateTotalTime(fileSizeMB)

    // Helper para logs com timestamp
    const logWithTime = (stage: string, message: string) => {
      const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1)
      console.log(`[TIMER ${elapsed}s] [${stage}] ${message}`)
    }

    try {
      if (isLargeFile) {
        // Arquivo grande: usa API route para upload direto ao Google AI
        logWithTime('START', `Arquivo grande: ${fileSizeDisplay}MB - usando upload direto`)

        // Fase 1: Upload (0-40%)
        setStatus('uploading')
        const uploadTime = fileSizeMB * TIME_ESTIMATES.uploadPerMB
        startProgressSimulation(0, 40, uploadTime, 'uploading', `Enviando ${fileSizeDisplay}MB...`)

        // Criar FormData para API route
        const formData = new FormData()
        formData.append('video', selectedFile)

        // Upload via API route
        abortControllerRef.current = new AbortController()

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          signal: abortControllerRef.current.signal
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || 'Falha no upload')
        }

        const uploadResult = await uploadResponse.json()

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Falha no upload')
        }

        logWithTime('UPLOAD', `Concluído - arquivo: ${uploadResult.fileName}`)

        // Limpar simulação de upload imediatamente
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }

        // Fase 2: Análise (40-100%) - pula direto para análise
        setStatus('analyzing')
        setUploadProgress({
          stage: 'analyzing',
          progress: 45,
          message: 'Analisando obstrução...',
          estimatedTimeRemaining: Math.round(TIME_ESTIMATES.analysisBase + (fileSizeMB * TIME_ESTIMATES.analysisPerMB))
        })

        const analysisTime = TIME_ESTIMATES.analysisBase + (fileSizeMB * TIME_ESTIMATES.analysisPerMB)
        startProgressSimulation(45, 98, analysisTime, 'analyzing', 'Analisando obstrução...')

        logWithTime('ANALYZE', 'Iniciando análise...')

        // Analisar usando URI
        const response = await analyzeVideoByUri({
          fileUri: uploadResult.fileUri,
          mimeType: uploadResult.mimeType,
          fileName: uploadResult.fileName
        })

        logWithTime('ANALYZE', 'Análise concluída')

        // Limpar interval
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }

        if (response.success && response.data) {
          logWithTime('COMPLETE', `Total: ${fileSizeDisplay}MB processado com sucesso`)
          setStatus('complete')
          setUploadProgress({
            stage: 'complete',
            progress: 100,
            message: 'Análise concluída!'
          })
          setResult(response.data)
        } else {
          setStatus('error')
          setError(response.error || 'Erro na análise')
        }

      } else {
        // Arquivo pequeno: usa Server Action direta
        logWithTime('START', `Arquivo pequeno: ${fileSizeDisplay}MB - usando Server Action direta`)

        // Fase 1: Enviando (0-30%)
        setStatus('uploading')
        const uploadTime = fileSizeMB * TIME_ESTIMATES.uploadPerMB
        startProgressSimulation(0, 30, uploadTime, 'uploading', `Enviando ${fileSizeDisplay}MB...`)

        const formData = new FormData()
        formData.append('video', selectedFile)

        // Pequena pausa para mostrar upload
        await new Promise(resolve => setTimeout(resolve, 500))

        // Fase 2: Processamento (30-50%)
        setStatus('processing')
        const processingTime = fileSizeMB * TIME_ESTIMATES.processingPerMB
        startProgressSimulation(30, 50, processingTime, 'processing', 'Processando vídeo...')

        // Fase 3: Análise (50-100%)
        setStatus('analyzing')
        const analysisTime = TIME_ESTIMATES.analysisBase + (fileSizeMB * TIME_ESTIMATES.analysisPerMB)
        startProgressSimulation(50, 98, analysisTime, 'analyzing', 'Analisando obstrução...')

        logWithTime('ANALYZE', 'Iniciando análise...')

        const response = await analyzeVideo(formData)

        logWithTime('ANALYZE', 'Análise concluída')

        // Limpar interval
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }

        if (response.success && response.data) {
          logWithTime('COMPLETE', `Total: ${fileSizeDisplay}MB processado com sucesso`)
          setStatus('complete')
          setUploadProgress({
            stage: 'complete',
            progress: 100,
            message: 'Análise concluída!'
          })
          setResult(response.data)
        } else {
          setStatus('error')
          setError(response.error || 'Erro desconhecido')
        }
      }
    } catch (err) {
      // Limpar interval em caso de erro
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }

      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[ANALYZE] Upload cancelado pelo usuário')
        setStatus('idle')
        setUploadProgress({ stage: 'idle', progress: 0, message: '' })
        return
      }
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Erro ao processar vídeo')
      setUploadProgress({
        stage: 'error',
        progress: 0,
        message: 'Erro no processamento'
      })
    }
  }

  const isProcessing = status === 'uploading' || status === 'processing' || status === 'analyzing'

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">DISE AI Analyzer</h1>
              <p className="text-sm text-slate-500">
                Monitoramento inteligente de obstrução de vias aéreas
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Coluna Esquerda - Upload e Vídeo */}
          <div className="space-y-6">
            <VideoUpload
              onFileSelect={handleFileSelect}
              disabled={isProcessing}
              selectedFile={selectedFile}
              onClear={handleClear}
            />

            {/* Preview do Vídeo */}
            {videoUrl && (
              <div className="card-medical">
                <h3 className="text-sm font-medium text-slate-600 mb-3">
                  Preview do Vídeo
                </h3>
                <video
                  src={videoUrl}
                  controls
                  className="w-full rounded-xl bg-black"
                  style={{ maxHeight: '300px' }}
                />
              </div>
            )}

            {/* Botão de Análise */}
            {selectedFile && !result && (
              <button
                onClick={handleAnalyze}
                disabled={isProcessing}
                className="btn-primary w-full"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Iniciar Análise
                  </>
                )}
              </button>
            )}

            {/* Status do Processamento */}
            <ProcessingStatus
              status={status}
              error={error}
              uploadProgress={uploadProgress}
            />
          </div>

          {/* Coluna Direita - Resultado */}
          <div>
            {result ? (
              <AnalysisResultComponent data={result} />
            ) : (
              <div className="card-medical h-full min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Stethoscope className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-medium">
                    Aguardando análise
                  </p>
                  <p className="text-sm text-slate-300 mt-1">
                    Selecione um vídeo e clique em Iniciar
                  </p>
                </div>
              </div>
            )}

            {/* Botão Nova Análise */}
            {result && (
              <button
                onClick={handleClear}
                className="btn-primary w-full mt-6 bg-slate-600 hover:bg-slate-700"
              >
                <RefreshCw className="w-5 h-5" />
                Nova Análise
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-slate-400">
            Powered by Eagle 2025 - Todos os direitos reservados
          </p>
        </div>
      </footer>
    </main>
  )
}
