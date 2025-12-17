// Análise de um nível anatômico específico
export interface LevelAnalysis {
  obstrucao_percentual: number
  padrao_colapso: string
  descricao: string
}

// Resultado completo com análise multinível
export interface AnalysisResult {
  // Análise por nível anatômico
  velo_palato: LevelAnalysis
  orofaringe: LevelAnalysis
  epiglote_base_lingua: LevelAnalysis
  // Metadados gerais
  nivel_confianca: number
  analise_clinica: string
}

export interface AnalysisResponse {
  success: boolean
  data?: AnalysisResult
  error?: string
}

export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'analyzing'
  | 'complete'
  | 'error'

// Progresso do upload/processamento
export interface UploadProgress {
  stage: 'idle' | 'uploading' | 'processing' | 'analyzing' | 'complete' | 'error'
  progress: number // 0-100
  message: string
  startTime?: number // timestamp de início
  estimatedTimeRemaining?: number // segundos restantes estimados
}
