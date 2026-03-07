import { NextRequest, NextResponse } from 'next/server';
import { Registry, executeTool } from '@/office/jarvis/tool-registry';
import { createClient } from '@/lib/supabase/server';
import { DocumentGenerator } from '@/office/tools/document-generator';
import { sendMessage } from '@/office/tools/communications';



export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { command, params } = body;

        if (!command) {
            return NextResponse.json({ error: 'Comando no proporcionado' }, { status: 400 });
        }

        // Mapeamos los comandos del chat a las tools del Registry
        let toolName = '';
        if (command === 'WEB_SEARCH') toolName = 'web-search';
        else if (command === 'WEB_BROWSER') toolName = 'web-browser';
        else if (command === 'FILE_MANAGER') toolName = 'file-manager';
        else if (command === 'DATA_ANALYZER') toolName = 'data-analyzer';
        else if (command === 'SEND_MESSAGE') toolName = 'communications';
        else if (command === 'EXECUTE_CODE') toolName = 'code-executor';
        else if (command === 'EMAIL_MANAGER') toolName = 'email-manager';
        else if (command === 'GENERATE_PDF' || command === 'GENERATE_EXCEL') {
            // Manejo directo para generación de docs (evita wrapper extra temporalmente)
            if (command === 'GENERATE_PDF') {
                const res = await DocumentGenerator.generatePDF({
                    title: params.title || 'Documento sin título',
                    content: params.content || '',
                    project_id: params.project_id
                });
                await sendMessage('telegram', '1404171793', `📄 PDF generado: ${res.title}\n📥 Disponible en la sección de Recursos.`);
                return NextResponse.json({ success: true, result: res });
            } else {
                const res = await DocumentGenerator.generateExcel({
                    title: params.title || 'Hoja de cálculo',
                    sheets: typeof params.sheets === 'string' ? JSON.parse(params.sheets) : params.sheets,
                    project_id: params.project_id
                });
                await sendMessage('telegram', '1404171793', `📊 Excel generado: ${res.title}\n📥 Disponible en la sección de Recursos.`);
                return NextResponse.json({ success: true, result: res });
            }
        }

        else {
            return NextResponse.json({ error: `Comando operativo no soportado por esta vía: ${command}` }, { status: 400 });
        }

        const toolDef = Registry.find(r => r.tool.name === toolName);
        if (!toolDef) {
            return NextResponse.json({ error: `Herramienta ${toolName} no encontrada en Registry` }, { status: 404 });
        }

        // Adaptamos params al formato esperado por cada tool
        let executeInput: any = {};

        if (command === 'WEB_SEARCH') {
            executeInput = { query: params.query };
        } else if (command === 'WEB_BROWSER') {
            executeInput = { url: params.url, action: params.action || 'visit' };
        } else if (command === 'FILE_MANAGER') {
            executeInput = { action: params.action, path: params.path, content: params.content, prefix: params.path };
        } else if (command === 'DATA_ANALYZER') {
            executeInput = { action: params.action, data: params.data, type: params.type, format: params.format };
        } else if (command === 'SEND_MESSAGE') {
            const chatId = params.to === 'CEO' || isNaN(Number(params.to))
                ? '1404171793'  // fallback al chat_id real del owner
                : params.to

            executeInput = {
                action: 'send',
                channel: params.channel,
                to: chatId,
                text: params.text || params.message || params.content || ''
            };
        } else if (command === 'EXECUTE_CODE') {
            executeInput = { language: params.language, code: params.code };
        }

        console.log('PARAMS RECIBIDOS:', JSON.stringify(params))
        console.log('EXECUTE INPUT:', JSON.stringify(executeInput))

        // 1. Obtener el agente actual (default J.A.R.V.I.S. si no se pasa uno)
        const supabase = await createClient();
        const { data: agent } = await supabase.from('agents').select('*').eq('name', 'J.A.R.V.I.S.').single();

        // 2. Ejecutar a través del wrapper auditado y seguro
        const result = await executeTool(toolName, executeInput, agent || { id: 'unknown', role: 'Coordinator' });

        return NextResponse.json({ success: true, result });

    } catch (err: any) {
        console.error('API /agent/run-tool Error:', err);
        return NextResponse.json({ error: err.message || 'Error interno ejecutando herramienta' }, { status: 500 });
    }
}
