import { NextRequest, NextResponse } from 'next/server'
import { Storage } from '@google-cloud/storage'
import { VertexAI } from '@google-cloud/vertexai'

export const maxDuration = 300 // 5 minutos
export const dynamic = 'force-dynamic'

const MODEL_NAME = 'gemini-2.0-flash'

export async function POST(request: NextRequest) {
  const serviceAccountJson = process.env.GCS_SERVICE_ACCOUNT
  const bucketName = process.env.GCS_BUCKET_NAME

  if (!serviceAccountJson || !bucketName) {
    return NextResponse.json({ success: false, error: 'Configuração GCS incompleta' }, { status: 500 })
  }

  let gcsFileName: string | null = null

  try {
    const { fileName, mimeType } = await request.json()
    gcsFileName = fileName

    if (!fileName) {
      return NextResponse.json({ success: false, error: 'fileName é obrigatório' }, { status: 400 })
    }

    console.log('[GCS-ANALYZE] Iniciando análise de:', fileName)

    // Parsear credenciais
    const credentials = JSON.parse(serviceAccountJson)

    // Inicializar GCS para verificar arquivo
    const storage = new Storage({ credentials, projectId: credentials.project_id })
    const bucket = storage.bucket(bucketName)
    const file = bucket.file(fileName)

    // Verificar se arquivo existe
    const [exists] = await file.exists()
    if (!exists) {
      return NextResponse.json({ success: false, error: 'Arquivo não encontrado no GCS' }, { status: 404 })
    }

    // URI do arquivo no GCS
    const gcsUri = `gs://${bucketName}/${fileName}`
    console.log('[GCS-ANALYZE] URI do arquivo:', gcsUri)
    console.log('[GCS-ANALYZE] Analisando com Vertex AI (Gemini 2.5 Pro)...')

    // Inicializar Vertex AI com as credenciais do service account
    const vertexAI = new VertexAI({
      project: credentials.project_id,
      location: 'us-central1',
      googleAuthOptions: {
        credentials: credentials
      }
    })

    const model = vertexAI.getGenerativeModel({ model: MODEL_NAME })

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

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            fileData: {
              mimeType: mimeType || 'video/mp4',
              fileUri: gcsUri,
            },
          },
          { text: prompt },
        ],
      }],
    })

    console.log('[GCS-ANALYZE] Resposta recebida')

    // Verificar bloqueio
    const response = result.response
    const candidate = response.candidates?.[0]
    if (!candidate || candidate.finishReason === 'SAFETY' || candidate.finishReason === 'OTHER') {
      throw new Error('Vídeo não aceito pelo sistema de análise. Tente outro vídeo.')
    }

    // Extrair texto da resposta (Vertex AI)
    const textPart = candidate.content?.parts?.find(part => 'text' in part)
    if (!textPart || !('text' in textPart)) {
      throw new Error('Resposta inválida do modelo')
    }

    // Parsear resposta
    let responseText = (textPart.text as string).trim()
    if (responseText.startsWith('```json')) responseText = responseText.slice(7)
    else if (responseText.startsWith('```')) responseText = responseText.slice(3)
    if (responseText.endsWith('```')) responseText = responseText.slice(0, -3)
    responseText = responseText.trim()

    const analysisData = JSON.parse(responseText)

    console.log('[GCS-ANALYZE] Análise concluída com sucesso!')

    return NextResponse.json({ success: true, data: analysisData })

  } catch (error) {
    console.error('[GCS-ANALYZE] Erro completo:', error)
    console.error('[GCS-ANALYZE] Erro message:', error instanceof Error ? error.message : 'Unknown')
    console.error('[GCS-ANALYZE] Erro stack:', error instanceof Error ? error.stack : 'No stack')

    let errorMessage = 'Erro durante a análise'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })

  } finally {
    // Deletar do GCS após análise
    const serviceAccountJson = process.env.GCS_SERVICE_ACCOUNT
    const bucketName = process.env.GCS_BUCKET_NAME

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
