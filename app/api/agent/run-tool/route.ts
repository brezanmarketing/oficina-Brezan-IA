import { NextRequest, NextResponse } from 'next/server';
import { Registry } from '@/office/jarvis/tool-registry';

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
            executeInput = {
                action: 'send',
                channel: params.channel,
                to: params.to || params.chat_id,
                text: params.text || params.message || params.content || ''
            };
        } else if (command === 'EXECUTE_CODE') {
            executeInput = { language: params.language, code: params.code };
        }

        const result = await toolDef.tool.execute(executeInput);

        return NextResponse.json({ success: true, result });
    } catch (err: any) {
        console.error('API /agent/run-tool Error:', err);
        return NextResponse.json({ error: err.message || 'Error interno ejecutando herramienta' }, { status: 500 });
    }
}
