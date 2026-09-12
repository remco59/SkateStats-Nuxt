import { PDFParse } from 'pdf-parse'
import { useDb } from '../../../db/client'
import { requireValidSession } from '../../../utils/access'
import { extractPdfResultsForSkater } from '../../../utils/import/pdf'
import { pdfResultsToImportPayload } from '../../../utils/import/pdf-source'
import { classifyImportPayload, savePreviewBatch } from '../../../utils/import/pipeline'

const MAX_PDF_UPLOAD_BYTES = 20 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, statusMessage: 'Geen bestand ontvangen.' })

  const fileEntry = form.find((f) => f.name === 'file')
  const skaterNameEntry = form.find((f) => f.name === 'skaterName')
  if (!fileEntry?.data) throw createError({ statusCode: 400, statusMessage: 'Geen PDF-bestand ontvangen.' })
  if (fileEntry.data.byteLength > MAX_PDF_UPLOAD_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'PDF is te groot (max 20MB).' })
  }
  const skaterName = skaterNameEntry?.data.toString('utf-8').trim()
  if (!skaterName) throw createError({ statusCode: 400, statusMessage: 'Geen schaatsersnaam ingesteld.' })

  let pageTexts: string[]
  try {
    const parser = new PDFParse({ data: fileEntry.data })
    const result = await parser.getText()
    await parser.destroy()
    pageTexts = result.pages.map((p) => p.text)
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: `Kon de PDF niet lezen (${(err as Error).message})` })
  }

  try {
    const parsed = extractPdfResultsForSkater(pageTexts, skaterName, fileEntry.filename ?? '')
    const db = useDb()
    const preview = classifyImportPayload(db, session.user.id, pdfResultsToImportPayload(parsed.competitions))
    const batchId = savePreviewBatch(db, session.user.id, preview)
    return { status: 'ok', batchId }
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }
})
