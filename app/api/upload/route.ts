import { NextRequest, NextResponse } from 'next/server'
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

// Configuração para aceitar arquivos grandes (até 2GB)
export const maxDuration = 300 // 5 minutos de timeout
export const dynamic = 'force-dynamic'

async function waitForFileProcessing(
  fileManager: GoogleAIFileManager,
  fileName: string,
  maxAttempts = 120 // 4 minutos de espera máxima
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const file = await fileManager.getFile(fileName)

    if (file.state === FileState.ACTIVE) {
      return
    }

    if (file.state === FileState.FAILED) {
      throw new Error('Falha no processamento do vídeo pelo Google AI')
    }

    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  throw new Error('Timeout aguardando processamento do vídeo')
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API Key não configurada' },
      { status: 500 }
    )
  }

  let tempFilePath: string | null = null

  try {
    const formData = await request.formData()
    const file = formData.get('video') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum vídeo fornecido' },
        { status: 400 }
      )
    }

    console.log('[UPLOAD API] Recebendo arquivo:', file.name, 'Tamanho:', (file.size / (1024 * 1024)).toFixed(2), 'MB')

    // Salvar arquivo temporariamente
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const tempFileName = `${randomUUID()}.mp4`
    tempFilePath = join(tmpdir(), tempFileName)

    await writeFile(tempFilePath, buffer)
    console.log('[UPLOAD API] Arquivo salvo temporariamente:', tempFilePath)

    // Upload para Google AI
    const fileManager = new GoogleAIFileManager(apiKey)

    console.log('[UPLOAD API] Iniciando upload para Google AI...')
    const uploadResult = await fileManager.uploadFile(tempFilePath, {
      mimeType: file.type || 'video/mp4',
      displayName: file.name,
    })

    console.log('[UPLOAD API] Upload concluído, aguardando processamento...')

    // Aguardar processamento
    await waitForFileProcessing(fileManager, uploadResult.file.name)

    console.log('[UPLOAD API] Arquivo pronto para análise:', uploadResult.file.uri)

    return NextResponse.json({
      success: true,
      fileUri: uploadResult.file.uri,
      fileName: uploadResult.file.name,
      mimeType: uploadResult.file.mimeType,
    })

  } catch (error) {
    console.error('[UPLOAD API] Erro:', error)

    let errorMessage = 'Erro no upload'

    if (error instanceof Error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('forbidden') || msg.includes('403')) {
        errorMessage = 'Acesso negado. Verifique se a API Key do Google está válida e tem permissões.'
      } else if (msg.includes('quota') || msg.includes('rate limit')) {
        errorMessage = 'Limite de uso da API atingido. Aguarde alguns minutos.'
      } else if (msg.includes('unauthorized') || msg.includes('401')) {
        errorMessage = 'API Key inválida. Configure uma chave válida do Google AI.'
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )

  } finally {
    // Limpar arquivo temporário
    if (tempFilePath) {
      try {
        await unlink(tempFilePath)
        console.log('[UPLOAD API] Arquivo temporário removido')
      } catch {
        // Ignorar erro de limpeza
      }
    }
  }
}
