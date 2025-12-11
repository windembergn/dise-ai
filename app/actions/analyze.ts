'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import type { AnalysisResponse, AnalysisResult } from '@/lib/types'

const MODEL_NAME = 'gemini-flash-lite-latest'

const SYSTEM_INSTRUCTION = `
Você é um software médico de precisão para análise de DISE (Drug-Induced Sleep Endoscopy).
Analise o vídeo para quantificar a obstrução da via aérea.

Saída JSON obrigatória:
{
    "obstrucao_percentual": (int 0-100),
    "nivel_confianca": (int 0-100),
    "estrutura_colapsada": (string completa, ex: "Palato Mole e Úvula"),
    "padrao_colapso": (string completa, ex: "Concêntrico"),
    "analise_clinica": (string, resumo claro e direto em pt-BR)
}
`

async function waitForFileProcessing(
  fileManager: GoogleAIFileManager,
  fileName: string,
  maxAttempts = 60
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const file = await fileManager.getFile(fileName)

    if (file.state === FileState.ACTIVE) {
      return
    }

    if (file.state === FileState.FAILED) {
      throw new Error('Falha no processamento do vídeo pelo Google AI')
    }

    // Aguarda 2 segundos entre verificações
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  throw new Error('Timeout aguardando processamento do vídeo')
}

export async function analyzeVideo(formData: FormData): Promise<AnalysisResponse> {
  const apiKey = process.env.GOOGLE_API_KEY

  if (!apiKey) {
    return {
      success: false,
      error: 'API Key não configurada. Configure GOOGLE_API_KEY nas variáveis de ambiente.'
    }
  }

  const file = formData.get('video') as File | null

  if (!file) {
    return {
      success: false,
      error: 'Nenhum vídeo fornecido'
    }
  }

  // Verificar tamanho (100MB max)
  if (file.size > 100 * 1024 * 1024) {
    return {
      success: false,
      error: 'Arquivo muito grande. Máximo permitido: 100MB'
    }
  }

  let tempFilePath: string | null = null

  try {
    // Salvar arquivo temporariamente
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const tempFileName = `${randomUUID()}.mp4`
    tempFilePath = join(tmpdir(), tempFileName)

    await writeFile(tempFilePath, buffer)

    // Inicializar Google AI
    const fileManager = new GoogleAIFileManager(apiKey)
    const genAI = new GoogleGenerativeAI(apiKey)

    // Upload para Google AI File API
    const uploadResult = await fileManager.uploadFile(tempFilePath, {
      mimeType: file.type || 'video/mp4',
      displayName: file.name,
    })

    // Aguardar processamento
    await waitForFileProcessing(fileManager, uploadResult.file.name)

    // Configurar modelo
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
      systemInstruction: SYSTEM_INSTRUCTION,
    })

    // Analisar vídeo
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri,
        },
      },
      { text: 'Analise o grau máximo de obstrução (Nadir) neste vídeo.' },
    ])

    const responseText = result.response.text()
    const analysisData: AnalysisResult = JSON.parse(responseText)

    // Deletar arquivo do Google AI (limpeza)
    try {
      await fileManager.deleteFile(uploadResult.file.name)
    } catch {
      // Ignorar erro de deleção - arquivo será excluído automaticamente
    }

    return {
      success: true,
      data: analysisData,
    }

  } catch (error) {
    console.error('Erro na análise:', error)

    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : 'Erro desconhecido durante a análise'
    }
  } finally {
    // Limpar arquivo temporário
    if (tempFilePath) {
      try {
        await unlink(tempFilePath)
      } catch {
        // Ignorar erro de limpeza
      }
    }
  }
}
