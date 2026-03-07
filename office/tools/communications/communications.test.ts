import { sendMessage, sendAlert } from './index';

async function runTests() {
    console.log('--- Iniciando Tests de Communications ---');

    try {
        console.log('\\n[1] Probando sendMessage simulado (Falta setup real, asume que fallara amablemente)...');
        try {
            await sendMessage('telegram', '123', 'Testing Jarvis');
        } catch (e: any) {
            console.log('✅ Fallo esperado sin token de Telegram:', e.message);
        }

        console.log('\\n[2] Probando sendAlert...');
        try {
            await sendAlert('info', 'Todo funciona correctamente en los tests');
            console.log('✅ sendAlert ejecutado');
        } catch (e: any) {
            console.error('❌ Falló sendAlert:', e.message);
        }

        console.log('\\n--- Todos los tests completados ---');
    } catch (err: any) {
        console.error('❌ Error en tests de Communications:', err.message);
    }
}

runTests();
