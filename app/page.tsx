'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Stethoscope, Play, RefreshCw } from 'lucide-react'
import VideoUpload from '@/components/VideoUpload'
import ProcessingStatus from '@/components/ProcessingStatus'
import AnalysisResultComponent from '@/components/AnalysisResult'
import { analyzeVideo } from './actions/analyze'
import type { AnalysisResult, UploadStatus, UploadProgress } from '@/lib/types'

// Limite para uso direto da Server Action (4MB - seguro para Vercel)
const DIRECT_UPLOAD_LIMIT = 4 * 1024 * 1024

// Estimativas de tempo (em segundos) baseadas em execução real
// Teste com 106MB: Upload ~10s, Análise ~40s, Total ~50s
const TIME_ESTIMATES = {
  uploadPerMB: 0.1, // Upload para GCS (~10s para 106MB)
  analysisBase: 35, // Tempo base para análise com Vertex AI
  analysisPerMB: 0.05, // Tempo adicional por MB do vídeo
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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
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

  // Função para simular progresso gradual
  const startProgressSimulation = (
    startProgress: number,
    endProgress: number,
    durationSeconds: number,
    stage: UploadProgress['stage'],
    message: string
  ) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }

    const startTime = Date.now()
    const totalDuration = durationSeconds * 1000

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progressRatio = Math.min(elapsed / totalDuration, 0.95)
      const currentProgress = startProgress + (endProgress - startProgress) * progressRatio
      const remainingTime = Math.max(0, (totalDuration - elapsed) / 1000)

      setUploadProgress({
        stage,
        progress: Math.round(currentProgress),
        message,
        startTime: startTimeRef.current,
        estimatedTimeRemaining: Math.round(remainingTime)
      })

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

    const logWithTime = (stage: string, message: string) => {
      const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1)
      console.log(`[TIMER ${elapsed}s] [${stage}] ${message}`)
    }

    try {
      if (isLargeFile) {
        // ========================================
        // ARQUIVO GRANDE: Upload via GCS
        // ========================================
        logWithTime('START', `Arquivo grande: ${fileSizeDisplay}MB - usando GCS`)
        console.log('[DEBUG] Iniciando fluxo GCS')

        // Fase 1: Obter URL assinada (0-5%)
        setStatus('uploading')
        setUploadProgress({
          stage: 'uploading',
          progress: 2,
          message: 'Preparando upload...'
        })

        console.log('[DEBUG] Obtendo URL assinada...')
        const signResponse = await fetch('/api/gcs/sign-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: selectedFile.name,
            contentType: selectedFile.type || 'video/mp4'
          })
        })

        if (!signResponse.ok) {
          const errData = await signResponse.json()
          throw new Error(errData.error || 'Erro ao preparar upload')
        }

        const signData = await signResponse.json()
        console.log('[DEBUG] URL assinada obtida:', signData.fileName)
        logWithTime('SIGN', 'URL assinada obtida')

        // Fase 2: Upload direto para GCS (5-20%)
        const uploadTime = fileSizeMB * TIME_ESTIMATES.uploadPerMB
        startProgressSimulation(5, 20, uploadTime, 'uploading', `Enviando ${fileSizeDisplay}MB...`)

        console.log('[DEBUG] Fazendo upload para GCS...')
        abortControllerRef.current = new AbortController()

        const uploadResponse = await fetch(signData.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': selectedFile.type || 'video/mp4' },
          body: selectedFile,
          signal: abortControllerRef.current.signal
        })

        if (!uploadResponse.ok) {
          throw new Error(`Erro no upload para GCS: ${uploadResponse.status}`)
        }

        console.log('[DEBUG] Upload para GCS concluído')
        logWithTime('UPLOAD', 'Upload para GCS concluído')

        // Limpar simulação
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }

        // Fase 3: Análise (20-98%)
        setStatus('analyzing')
        setUploadProgress({
          stage: 'analyzing',
          progress: 22,
          message: 'Analisando obstrução...'
        })

        const analysisTime = TIME_ESTIMATES.analysisBase + (fileSizeMB * TIME_ESTIMATES.analysisPerMB)
        startProgressSimulation(22, 98, analysisTime, 'analyzing', 'Analisando obstrução...')

        console.log('[DEBUG] Iniciando análise via GCS...')
        logWithTime('ANALYZE', 'Iniciando análise')

        const analyzeResponse = await fetch('/api/gcs/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: signData.fileName,
            mimeType: selectedFile.type || 'video/mp4'
          })
        })

        const analyzeResult = await analyzeResponse.json()
        console.log('[DEBUG] Resultado da análise:', analyzeResult)

        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }

        if (analyzeResult.success && analyzeResult.data) {
          logWithTime('COMPLETE', `Total: ${fileSizeDisplay}MB processado com sucesso`)
          setStatus('complete')
          setUploadProgress({
            stage: 'complete',
            progress: 100,
            message: 'Análise concluída!'
          })
          setResult(analyzeResult.data)
        } else {
          setStatus('error')
          setError(analyzeResult.error || 'Erro na análise')
        }

      } else {
        // ========================================
        // ARQUIVO PEQUENO: Server Action direta
        // ========================================
        logWithTime('START', `Arquivo pequeno: ${fileSizeDisplay}MB - usando Server Action`)

        setStatus('uploading')
        startProgressSimulation(0, 30, 2, 'uploading', `Enviando ${fileSizeDisplay}MB...`)

        const formData = new FormData()
        formData.append('video', selectedFile)

        await new Promise(resolve => setTimeout(resolve, 500))

        setStatus('processing')
        startProgressSimulation(30, 50, 2, 'processing', 'Processando vídeo...')

        setStatus('analyzing')
        const analysisTime = TIME_ESTIMATES.analysisBase
        startProgressSimulation(50, 98, analysisTime, 'analyzing', 'Analisando obstrução...')

        logWithTime('ANALYZE', 'Iniciando análise')

        const response = await analyzeVideo(formData)

        logWithTime('ANALYZE', 'Análise concluída')

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
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }

      console.error('[DEBUG] Erro:', err)

      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[DEBUG] Upload cancelado')
        setStatus('idle')
        setUploadProgress({ stage: 'idle', progress: 0, message: '' })
        return
      }

      const errorMsg = err instanceof Error ? err.message : 'Erro ao processar vídeo'
      console.error('[DEBUG] Erro final:', errorMsg)

      setStatus('error')
      setError(errorMsg)
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
