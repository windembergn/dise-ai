import { NextRequest, NextResponse } from 'next/server'
import { Storage } from '@google-cloud/storage'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { fileName, contentType } = await request.json()

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: 'fileName e contentType são obrigatórios' },
        { status: 400 }
      )
    }

    const serviceAccountJson = process.env.GCS_SERVICE_ACCOUNT
    const bucketName = process.env.GCS_BUCKET_NAME

    if (!serviceAccountJson || !bucketName) {
      console.error('[GCS] Variáveis de ambiente não configuradas')
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      )
    }

    // Parse das credenciais
    let credentials
    try {
      credentials = JSON.parse(serviceAccountJson)
    } catch {
      console.error('[GCS] Erro ao parsear credenciais')
      return NextResponse.json(
        { error: 'Erro na configuração do servidor' },
        { status: 500 }
      )
    }

    // Inicializar Storage com credenciais
    const storage = new Storage({
      credentials,
      projectId: credentials.project_id,
    })

    // Gerar nome único para o arquivo
    const uniqueFileName = `uploads/${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    const bucket = storage.bucket(bucketName)
    const file = bucket.file(uniqueFileName)

    // Gerar URL assinada para upload (válida por 15 minutos)
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutos
      contentType,
    })

    console.log('[GCS] URL assinada gerada para:', uniqueFileName)

    return NextResponse.json({
      success: true,
      signedUrl,
      fileName: uniqueFileName,
      bucketName,
      gcsUri: `gs://${bucketName}/${uniqueFileName}`,
    })

  } catch (error) {
    console.error('[GCS] Erro ao gerar URL assinada:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar URL de upload' },
      { status: 500 }
    )
  }
}
