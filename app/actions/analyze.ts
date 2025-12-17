'use server'

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import type { AnalysisResponse, AnalysisResult } from '@/lib/types'

// Interface para análise via URI (arquivos já uploadados)
interface FileInfo {
  fileUri: string
  mimeType: string
  fileName: string
}

// Usando gemini-2.5-pro que é mais capaz para análise de vídeo médico
const MODEL_NAME = 'gemini-2.5-pro'

const SYSTEM_INSTRUCTION = `
Você é um software médico de precisão para análise de DISE (Drug-Induced Sleep Endoscopy).

O vídeo de endoscopia é contínuo e percorre a garganta de CIMA para BAIXO. Analise SEPARADAMENTE três regiões anatômicas conforme a câmera desce:

1. **VELO/PALATO** (Início do vídeo - região superior):
   - Inclui: Palato mole, úvula, véu palatino
   - Momento: Primeiros frames do vídeo

2. **OROFARINGE** (Meio do vídeo - região intermediária):
   - Inclui: Paredes laterais, tonsilas palatinas, parede posterior
   - Momento: Porção central do vídeo

3. **EPIGLOTE/BASE DE LÍNGUA** (Fim do vídeo - região inferior):
   - Inclui: Epiglote, base de língua, valécula
   - Momento: Frames finais do vídeo

Para CADA região anatômica, determine:
- obstrucao_percentual: grau máximo de obstrução observado (0-100%)
- padrao_colapso: tipo de colapso (Anteroposterior, Lateral, Concêntrico, ou Ausente)
- descricao: breve descrição do achado naquele nível

Saída JSON obrigatória com análise MULTINÍVEL:
{
    "velo_palato": {
        "obstrucao_percentual": (int 0-100),
        "padrao_colapso": (string: "Anteroposterior" | "Lateral" | "Concêntrico" | "Ausente"),
        "descricao": (string em pt-BR, max 100 chars)
    },
    "orofaringe": {
        "obstrucao_percentual": (int 0-100),
        "padrao_colapso": (string: "Anteroposterior" | "Lateral" | "Concêntrico" | "Ausente"),
        "descricao": (string em pt-BR, max 100 chars)
    },
    "epiglote_base_lingua": {
        "obstrucao_percentual": (int 0-100),
        "padrao_colapso": (string: "Anteroposterior" | "Lateral" | "Concêntrico" | "Ausente"),
        "descricao": (string em pt-BR, max 100 chars)
    },
    "nivel_confianca": (int 0-100, confiança geral da análise),
    "analise_clinica": (string, resumo integrado de todos os níveis em pt-BR)
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

    // Configurar modelo com safety settings para conteúdo médico
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
      systemInstruction: SYSTEM_INSTRUCTION,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    })

    // Analisar vídeo
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri,
        },
      },
      { text: 'Este é um vídeo médico de endoscopia DISE para análise clínica. Analise segmentando por nível anatômico (Velo/Palato, Orofaringe, Epiglote/Base de Língua). Identifique o grau de obstrução (Nadir) em cada região.' },
    ])

    // Log detalhado da resposta
    console.log('[ANALYZE] Resposta recebida')
    console.log('[ANALYZE] Candidates:', JSON.stringify(result.response.candidates, null, 2))
    console.log('[ANALYZE] Prompt Feedback:', JSON.stringify(result.response.promptFeedback, null, 2))

    // Verificar se há bloqueio por candidato ou por promptFeedback
    const candidate = result.response.candidates?.[0]
    const promptFeedback = result.response.promptFeedback

    const isBlocked =
      candidate?.finishReason === 'SAFETY' ||
      candidate?.finishReason === 'OTHER' ||
      promptFeedback?.blockReason === 'OTHER' ||
      promptFeedback?.blockReason === 'SAFETY' ||
      !candidate

    if (isBlocked) {
      const reason = candidate?.finishReason || promptFeedback?.blockReason || 'UNKNOWN'
      console.error('[ANALYZE] Resposta bloqueada:', reason)
      return {
        success: false,
        error: 'Este vídeo não foi aceito pelo sistema de análise. Por favor, tente enviar outro vídeo.'
      }
    }

    let responseText = result.response.text()
    console.log('[ANALYZE] Texto da resposta:', responseText.substring(0, 200))

    // Remover markdown se presente (```json ... ```)
    responseText = responseText.trim()
    if (responseText.startsWith('```json')) {
      responseText = responseText.slice(7)
    } else if (responseText.startsWith('```')) {
      responseText = responseText.slice(3)
    }
    if (responseText.endsWith('```')) {
      responseText = responseText.slice(0, -3)
    }
    responseText = responseText.trim()

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
    console.error('[ANALYZE] Erro na análise:', error)

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

// Análise via URI (para arquivos já uploadados via API route)
// Usado para arquivos grandes que passaram pelo upload direto
export async function analyzeVideoByUri(fileInfo: FileInfo): Promise<AnalysisResponse> {
  const apiKey = process.env.GOOGLE_API_KEY

  if (!apiKey) {
    return {
      success: false,
      error: 'API Key não configurada. Configure GOOGLE_API_KEY nas variáveis de ambiente.'
    }
  }

  try {
    console.log('[ANALYZE BY URI] Iniciando análise do arquivo:', fileInfo.fileName)

    const genAI = new GoogleGenerativeAI(apiKey)
    const fileManager = new GoogleAIFileManager(apiKey)

    // Configurar modelo - configuração simplificada
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
    })

    // Prompt completo com instruções e formato de saída
    const fullPrompt = `Você é um software médico de precisão para análise de DISE (Drug-Induced Sleep Endoscopy).

Este vídeo mostra um exame de endoscopia da via aérea superior durante sono induzido. Analise o vídeo e identifique o grau de obstrução em cada nível anatômico.

Responda APENAS com um JSON válido no seguinte formato (sem markdown, sem explicações extras):
{
  "velo_palato": {
    "obstrucao_percentual": <número 0-100>,
    "padrao_colapso": "<Anteroposterior|Lateral|Concêntrico|Ausente>",
    "descricao": "<descrição breve>"
  },
  "orofaringe": {
    "obstrucao_percentual": <número 0-100>,
    "padrao_colapso": "<Anteroposterior|Lateral|Concêntrico|Ausente>",
    "descricao": "<descrição breve>"
  },
  "epiglote_base_lingua": {
    "obstrucao_percentual": <número 0-100>,
    "padrao_colapso": "<Anteroposterior|Lateral|Concêntrico|Ausente>",
    "descricao": "<descrição breve>"
  },
  "nivel_confianca": <número 0-100>,
  "analise_clinica": "<resumo clínico integrado>"
}`

    // Analisar vídeo usando o URI
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: fileInfo.mimeType,
          fileUri: fileInfo.fileUri,
        },
      },
      { text: fullPrompt },
    ])

    // Log detalhado da resposta
    console.log('[ANALYZE BY URI] Resposta recebida')
    console.log('[ANALYZE BY URI] Candidates:', JSON.stringify(result.response.candidates, null, 2))
    console.log('[ANALYZE BY URI] Prompt Feedback:', JSON.stringify(result.response.promptFeedback, null, 2))

    // Verificar se há bloqueio por candidato ou por promptFeedback
    const candidate = result.response.candidates?.[0]
    const promptFeedback = result.response.promptFeedback

    const isBlocked =
      candidate?.finishReason === 'SAFETY' ||
      candidate?.finishReason === 'OTHER' ||
      promptFeedback?.blockReason === 'OTHER' ||
      promptFeedback?.blockReason === 'SAFETY' ||
      !candidate

    if (isBlocked) {
      const reason = candidate?.finishReason || promptFeedback?.blockReason || 'UNKNOWN'
      console.error('[ANALYZE BY URI] Resposta bloqueada:', reason)

      // Deletar arquivo mesmo com erro
      try {
        await fileManager.deleteFile(fileInfo.fileName)
      } catch {
        // Ignorar
      }

      return {
        success: false,
        error: 'Este vídeo não foi aceito pelo sistema de análise. Por favor, tente enviar outro vídeo.'
      }
    }

    let responseText = result.response.text()
    console.log('[ANALYZE BY URI] Texto da resposta:', responseText.substring(0, 200))

    // Remover markdown se presente (```json ... ```)
    responseText = responseText.trim()
    if (responseText.startsWith('```json')) {
      responseText = responseText.slice(7) // Remove ```json
    } else if (responseText.startsWith('```')) {
      responseText = responseText.slice(3) // Remove ```
    }
    if (responseText.endsWith('```')) {
      responseText = responseText.slice(0, -3) // Remove ``` do final
    }
    responseText = responseText.trim()

    const analysisData: AnalysisResult = JSON.parse(responseText)

    // Deletar arquivo do Google AI (limpeza)
    try {
      await fileManager.deleteFile(fileInfo.fileName)
      console.log('[ANALYZE BY URI] Arquivo removido do Google AI')
    } catch {
      // Ignorar erro de deleção
    }

    console.log('[ANALYZE BY URI] Análise concluída com sucesso')

    return {
      success: true,
      data: analysisData,
    }

  } catch (error) {
    console.error('[ANALYZE BY URI] Erro:', error)

    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : 'Erro desconhecido durante a análise'
    }
  }
}
