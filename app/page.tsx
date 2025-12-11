'use client'

import { useState, useCallback } from 'react'
import { Stethoscope, Play, RefreshCw } from 'lucide-react'
import VideoUpload from '@/components/VideoUpload'
import ProcessingStatus from '@/components/ProcessingStatus'
import AnalysisResultComponent from '@/components/AnalysisResult'
import { analyzeVideo } from './actions/analyze'
import type { AnalysisResult, UploadStatus } from '@/lib/types'

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string>('')
  const [result, setResult] = useState<AnalysisResult | null>(null)

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file)
    setVideoUrl(URL.createObjectURL(file))
    setResult(null)
    setError('')
    setStatus('idle')
  }, [])

  const handleClear = useCallback(() => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
    }
    setSelectedFile(null)
    setVideoUrl(null)
    setResult(null)
    setError('')
    setStatus('idle')
  }, [videoUrl])

  const handleAnalyze = async () => {
    if (!selectedFile) return

    setStatus('uploading')
    setError('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('video', selectedFile)

      setStatus('processing')

      const response = await analyzeVideo(formData)

      if (response.success && response.data) {
        setStatus('complete')
        setResult(response.data)
      } else {
        setStatus('error')
        setError(response.error || 'Erro desconhecido')
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Erro ao processar vídeo')
    }
  }

  const isProcessing = status === 'uploading' || status === 'processing' || status === 'analyzing'

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
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
            <ProcessingStatus status={status} error={error} />
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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <p className="text-center text-sm text-slate-400">
            Powered by Eagle 2025 - Todos os direitos reservados
          </p>
        </div>
      </footer>
    </main>
  )
}
