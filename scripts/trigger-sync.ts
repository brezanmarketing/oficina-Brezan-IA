import { runFullSync } from '../office/jarvis/calendar-sync';
import * as dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    console.log('--- DIAGNÓSTICO DE SINCRONIZACIÓN ---');
    console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('KEY:', process.env.SUPABASE_SERVICE_KEY ? 'Presente' : 'MISSING');

    try {
        await runFullSync();
        console.log('--- DIAGNÓSTICO COMPLETADO ---');
    } catch (error) {
        console.error('--- ERROR EN DIAGNÓSTICO ---');
        console.error(error);
    }
}

main();
