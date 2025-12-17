import { NextRequest, NextResponse } from 'next/server'
import { Storage } from '@google-cloud/storage'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

export const maxDuration = 300 // 5 minutos
export const dynamic = 'force-dynamic'

const MODEL_NAME = 'gemini-2.5-pro'

async function waitForFileProcessing(
  fileManager: GoogleAIFileManager,
  fileName: string,
  maxAttempts = 120
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const file = await fileManager.getFile(fileName)
    if (file.state === FileState.ACTIVE) return
    if (file.state === FileState.FAILED) {
      throw new Error('Falha no processamento do vídeo')
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  throw new Error('Timeout aguardando processamento do vídeo')
}

export async function POST(request: NextRequest) {
  const googleApiKey = process.env.GOOGLE_API_KEY
  const serviceAccountJson = process.env.GCS_SERVICE_ACCOUNT
  const bucketName = process.env.GCS_BUCKET_NAME

  if (!googleApiKey) {
    return NextResponse.json({ success: false, error: 'GOOGLE_API_KEY não configurada' }, { status: 500 })
  }

  if (!serviceAccountJson || !bucketName) {
    return NextResponse.json({ success: false, error: 'Configuração GCS incompleta' }, { status: 500 })
  }

  let tempFilePath: string | null = null
  let geminiFileName: string | null = null
  let gcsFileName: string | null = null

  try {
    const { fileName, mimeType } = await request.json()
    gcsFileName = fileName

    if (!fileName) {
      return NextResponse.json({ success: false, error: 'fileName é obrigatório' }, { status: 400 })
    }

    console.log('[GCS-ANALYZE] Iniciando análise de:', fileName)

    // Inicializar GCS
    const credentials = JSON.parse(serviceAccountJson)
    const storage = new Storage({ credentials, projectId: credentials.project_id })
    const bucket = storage.bucket(bucketName)
    const file = bucket.file(fileName)

    // Verificar se arquivo existe
    const [exists] = await file.exists()
    if (!exists) {
      return NextResponse.json({ success: false, error: 'Arquivo não encontrado no GCS' }, { status: 404 })
    }

    console.log('[GCS-ANALYZE] Baixando arquivo do GCS...')

    // Baixar para /tmp
    const tempFileName = `${Date.now()}-video.mp4`
    tempFilePath = join(tmpdir(), tempFileName)
    await file.download({ destination: tempFilePath })

    console.log('[GCS-ANALYZE] Arquivo baixado, enviando para Gemini...')

    // Upload para Gemini File API
    const fileManager = new GoogleAIFileManager(googleApiKey)
    const uploadResult = await fileManager.uploadFile(tempFilePath, {
      mimeType: mimeType || 'video/mp4',
      displayName: fileName,
    })

    geminiFileName = uploadResult.file.name

    console.log('[GCS-ANALYZE] Aguardando processamento no Gemini...')
    await waitForFileProcessing(fileManager, geminiFileName)

    console.log('[GCS-ANALYZE] Analisando com Gemini 2.5 Pro...')

    // Analisar com Gemini
    const genAI = new GoogleGenerativeAI(googleApiKey)
    const model = genAI.getGenerativeModel({ model: MODEL_NAME })

    const prompt = `Você é um software médico de precisão para análise de DISE (Drug-Induced Sleep Endoscopy).

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

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri,
        },
      },
      { text: prompt },
    ])

    console.log('[GCS-ANALYZE] Resposta recebida')

    // Verificar bloqueio
    const candidate = result.response.candidates?.[0]
    if (!candidate || candidate.finishReason === 'SAFETY' || candidate.finishReason === 'OTHER') {
      throw new Error('Vídeo não aceito pelo sistema de análise. Tente outro vídeo.')
    }

    // Parsear resposta
    let responseText = result.response.text().trim()
    if (responseText.startsWith('```json')) responseText = responseText.slice(7)
    else if (responseText.startsWith('```')) responseText = responseText.slice(3)
    if (responseText.endsWith('```')) responseText = responseText.slice(0, -3)
    responseText = responseText.trim()

    const analysisData = JSON.parse(responseText)

    console.log('[GCS-ANALYZE] Análise concluída com sucesso!')

    return NextResponse.json({ success: true, data: analysisData })

  } catch (error) {
    console.error('[GCS-ANALYZE] Erro:', error)

    let errorMessage = 'Erro durante a análise'
    if (error instanceof Error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('forbidden') || msg.includes('403')) {
        errorMessage = 'Acesso negado. Verifique as configurações.'
      } else if (msg.includes('quota')) {
        errorMessage = 'Limite de uso atingido. Aguarde alguns minutos.'
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })

  } finally {
    // Limpeza
    const googleApiKey = process.env.GOOGLE_API_KEY
    const serviceAccountJson = process.env.GCS_SERVICE_ACCOUNT
    const bucketName = process.env.GCS_BUCKET_NAME

    // Deletar arquivo temporário
    if (tempFilePath) {
      try {
        await unlink(tempFilePath)
        console.log('[GCS-ANALYZE] Arquivo temporário removido')
      } catch { /* ignore */ }
    }

    // Deletar do Gemini
    if (geminiFileName && googleApiKey) {
      try {
        const fileManager = new GoogleAIFileManager(googleApiKey)
        await fileManager.deleteFile(geminiFileName)
        console.log('[GCS-ANALYZE] Arquivo removido do Gemini')
      } catch { /* ignore */ }
    }

    // Deletar do GCS
    if (gcsFileName && serviceAccountJson && bucketName) {
      try {
        const credentials = JSON.parse(serviceAccountJson)
        const storage = new Storage({ credentials, projectId: credentials.project_id })
        await storage.bucket(bucketName).file(gcsFileName).delete()
        console.log('[GCS-ANALYZE] Arquivo removido do GCS')
      } catch { /* ignore */ }
    }
  }
}
