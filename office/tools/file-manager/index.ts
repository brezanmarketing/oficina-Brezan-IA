import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'office-files';

export interface FileRecord {
    id?: string;
    filename: string;
    path: string;
    category: string;
    size_bytes: number;
    mime_type: string;
    storage_url?: string;
    modified_by?: string;
    metadata?: any;
    created_at?: string;
    updated_at?: string;
}

function getCategory(filename: string): string {
    const ext = path.extname(filename).toLowerCase();

    const documents = ['.pdf', '.docx', '.txt', '.md'];
    const data = ['.json', '.csv', '.xlsx'];
    const code = ['.js', '.ts', '.py', '.html', '.css', '.tsx', '.jsx'];
    const media = ['.png', '.jpg', '.jpeg', '.gif', '.svg'];

    if (documents.includes(ext)) return 'documentos';
    if (data.includes(ext)) return 'datos';
    if (code.includes(ext)) return 'codigo';
    if (media.includes(ext)) return 'media';

    return 'reportes'; // fallback
}

function getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const types: Record<string, string> = {
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.csv': 'text/csv',
        '.json': 'application/json',
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.js': 'application/javascript',
        '.py': 'text/x-python',
        '.html': 'text/html'
    };
    return types[ext] || 'application/octet-stream';
}

export async function readFile(filePath: string): Promise<Buffer | string> {
    const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .download(filePath);

    if (error) {
        throw new Error(`Error leyendo archivo ${filePath}: ${error.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Si es un archivo de texto o json, lo devolvemos como string
    const mime = getMimeType(filePath);
    if (mime.startsWith('text/') || mime === 'application/json' || filePath.endsWith('.md')) {
        return buffer.toString('utf-8');
    }

    return buffer;
}

export async function writeFile(filePath: string, content: Buffer | string, metadata?: any): Promise<FileRecord> {
    let fileBody: Buffer | string = content;

    // Subimos a Storage
    const { data: storageData, error: storageError } = await supabase
        .storage
        .from(BUCKET_NAME)
        .upload(filePath, fileBody, {
            contentType: getMimeType(filePath),
            upsert: true
        });

    if (storageError) {
        throw new Error(`Error subiendo archivo ${filePath}: ${storageError.message}`);
    }

    // Obtenemos size real si era buffer o string
    const sizeBytes = Buffer.isBuffer(fileBody) ? fileBody.length : Buffer.from(fileBody).length;
    const filename = path.basename(filePath);

    const record: FileRecord = {
        filename,
        path: filePath,
        category: getCategory(filename),
        size_bytes: sizeBytes,
        mime_type: getMimeType(filename),
        metadata: metadata || {}
    };

    // Guardamos / Actualizamos en files_registry
    const { data: dbData, error: dbError } = await supabase
        .from('files_registry')
        .upsert({
            ...record,
            storage_url: `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${filePath}`,
            updated_at: new Date().toISOString()
        }, { onConflict: 'path' })
        .select()
        .single();

    if (dbError) {
        console.error('Error actualizando files_registry:', dbError);
    }

    return dbData || record;
}

export async function deleteFile(filePath: string): Promise<void> {
    // Nunca borramos, movemos a archive
    const filename = path.basename(filePath);
    const archivePath = `archive/${Date.now()}_${filename}`;

    await moveFile(filePath, archivePath);
}

export async function moveFile(fromPath: string, toPath: string): Promise<FileRecord> {
    const { error: moveError } = await supabase
        .storage
        .from(BUCKET_NAME)
        .move(fromPath, toPath);

    if (moveError) {
        throw new Error(`Error moviendo archivo de ${fromPath} a ${toPath}: ${moveError.message}`);
    }

    // Actualizar tabla
    const { data: oldRecord } = await supabase
        .from('files_registry')
        .select('*')
        .eq('path', fromPath)
        .single();

    if (oldRecord) {
        await supabase.from('files_registry').delete().eq('path', fromPath);

        oldRecord.path = toPath;
        oldRecord.filename = path.basename(toPath);
        oldRecord.category = getCategory(toPath);
        oldRecord.mime_type = getMimeType(toPath);

        const { data: newRecord } = await supabase
            .from('files_registry')
            .insert(oldRecord)
            .select()
            .single();

        return newRecord || oldRecord;
    }

    throw new Error(`El archivo base ${fromPath} no existía en el registro.`);
}

export async function listFiles(prefixStr?: string, categoryStr?: string): Promise<FileRecord[]> {
    let query = supabase.from('files_registry').select('*');

    if (categoryStr) {
        query = query.eq('category', categoryStr);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
        throw new Error(`Error listando archivos: ${error.message}`);
    }

    let results = data as FileRecord[];

    if (prefixStr) {
        // Supabase no soporta startsWith bien a menos que validemos LIKE 'prefixStr%'
        // es más seguro filtrar localmente
        results = results.filter(r => r.path.startsWith(prefixStr));
    }

    return results;
}

export async function getFileUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, expiresIn);

    if (error || !data) {
        throw new Error(`Error generando URL para ${filePath}: ${error?.message}`);
    }

    return data.signedUrl;
}
