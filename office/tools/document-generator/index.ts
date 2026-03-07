import { getSupabaseService } from '@/office/jarvis/phase4/supabase-service'
import ExcelJS from 'exceljs'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export interface ResourceOptions {
    title: string
    content?: string
    template?: 'informe' | 'plan' | 'resumen' | 'factura'
    project_id?: string
    created_by?: string
    sheets?: any[]
}

export interface ResourceRecord {
    id: string
    title: string
    storage_path: string
    storage_url: string
    type: string
}

export class DocumentGenerator {
    /**
     * Genera un PDF profesional con Puppeteer y lo sube a Supabase.
     */
    static async generatePDF(options: ResourceOptions): Promise<ResourceRecord> {
        console.log(`[DocumentGenerator] Generando PDF: ${options.title}`)

        const browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true,
        })

        const page = await browser.newPage()

        // Template HTML Básico con Branding Brezan
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Arial', sans-serif; color: #1e293b; padding: 40px; }
                    .header { border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
                    .logo { font-size: 24px; font-weight: bold; color: #6366f1; }
                    .title { font-size: 32px; font-weight: 800; margin-bottom: 10px; }
                    .content { line-height: 1.6; }
                    .footer { position: fixed; bottom: 0; left: 0; right: 0; height: 30px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; padding: 10px 40px; }
                    pre { background: #f1f5f9; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">Brezan Solutions IA</div>
                    <div style="text-align: right; font-size: 12px; color: #64748b;">${new Date().toLocaleDateString('es-ES')}</div>
                </div>
                <h1 class="title">${options.title}</h1>
                <div class="content">
                    ${options.content || 'Sin contenido proporcionado.'}
                </div>
                <div class="footer">
                    <div>Generado por J.A.R.V.I.S. · Brezan Intelligence</div>
                    <div>Confidencial · Reservado</div>
                </div>
            </body>
            </html>
        `

        await page.setContent(html, { waitUntil: 'networkidle0' })
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
        })

        await browser.close()

        const supabase = getSupabaseService()
        if (!supabase) throw new Error('Supabase client failed')

        // 2. Subir a Supabase Storage
        const fileName = `${Date.now()}_${options.title.replace(/\s+/g, '_')}.pdf`
        const storagePath = `documents/${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('office-resources')
            .upload(storagePath, pdfBuffer, { contentType: 'application/pdf' })

        if (uploadError) throw uploadError

        // 3. Registrar en BD
        const { data: resource, error: dbError } = await supabase
            .from('office_resources')
            .insert({
                title: options.title,
                type: 'pdf',
                storage_path: storagePath,
                project_id: options.project_id || null,
                created_by: options.created_by || 'jarvis',
                size_bytes: pdfBuffer.length
            })
            .select()
            .single()

        if (dbError) throw dbError

        // 4. URL Firmada
        const { data: signed } = await supabase.storage
            .from('office-resources')
            .createSignedUrl(storagePath, 604800) // 7 días

        return {
            id: resource.id,
            title: resource.title,
            storage_path: resource.storage_path,
            storage_url: signed?.signedUrl || '',
            type: 'pdf'
        }
    }

    /**
     * Genera un Excel estructurado.
     */
    static async generateExcel(options: ResourceOptions): Promise<ResourceRecord> {
        console.log(`[DocumentGenerator] Generando Excel: ${options.title}`)
        const workbook = new ExcelJS.Workbook()

        // Hoja de Resumen
        const summarySheet = workbook.addWorksheet('Resumen')
        summarySheet.addRow(['INFORME ESTRATÉGICO BREZAN IA'])
        summarySheet.addRow(['Título:', options.title])
        summarySheet.addRow(['Fecha:', new Date().toISOString()])
        summarySheet.addRow(['Generado por:', 'J.A.R.V.I.S.'])
        summarySheet.getColumn(1).font = { bold: true }
        summarySheet.getColumn(1).width = 20

        // Hojas de Datos
        if (options.sheets && options.sheets.length > 0) {
            options.sheets.forEach(s => {
                const sheet = workbook.addWorksheet(s.name || 'Datos')

                // Headers
                const headerRow = sheet.addRow(s.headers)
                headerRow.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
                    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
                })

                // Rows
                s.rows.forEach((r: any[]) => sheet.addRow(r))

                // Auto-ajuste simple
                sheet.columns.forEach(col => { col.width = 20 })
            })
        }

        const buffer = await workbook.xlsx.writeBuffer() as any

        const supabase = getSupabaseService()
        if (!supabase) throw new Error('Supabase client failed')

        // 2. Subir a Supabase
        const fileName = `${Date.now()}_${options.title.replace(/\s+/g, '_')}.xlsx`
        const storagePath = `spreadsheets/${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('office-resources')
            .upload(storagePath, buffer, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

        if (uploadError) throw uploadError

        // 3. Registrar en BD
        const { data: resource, error: dbError } = await supabase
            .from('office_resources')
            .insert({
                title: options.title,
                type: 'excel',
                storage_path: storagePath,
                project_id: options.project_id || null,
                created_by: options.created_by || 'jarvis',
                size_bytes: buffer.length
            })
            .select()
            .single()

        if (dbError) throw dbError

        const { data: signed } = await supabase.storage
            .from('office-resources')
            .createSignedUrl(storagePath, 604800)

        return {
            id: resource.id,
            title: resource.title,
            storage_path: resource.storage_path,
            storage_url: signed?.signedUrl || '',
            type: 'excel'
        }
    }

    /**
     * Helper para obtener URL firmada de cualquier recurso.
     */
    static async getResourceURL(storagePath: string): Promise<string> {
        const supabase = getSupabaseService()
        if (!supabase) return ''
        const { data } = await supabase.storage
            .from('office-resources')
            .createSignedUrl(storagePath, 604800)
        return data?.signedUrl || ''
    }
}
