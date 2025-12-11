export interface AnalysisResult {
  obstrucao_percentual: number
  nivel_confianca: number
  estrutura_colapsada: string
  padrao_colapso: string
  analise_clinica: string
}

export interface AnalysisResponse {
  success: boolean
  data?: AnalysisResult
  error?: string
}

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'analyzing' | 'complete' | 'error'
