import { classifyEmail } from './index';

async function runTests() {
    console.log('--- Iniciando Tests de Email Manager ---');

    try {
        console.log('\\n[1] Probando classificación de emails falsa...');

        const emailUrgent = await classifyEmail({
            id: '1', threadId: '1', date: '', from: 'boss@empresa.com', to: 'me',
            subject: 'Urgente: el servidor está caído',
            snippet: '', body: 'por favor ayuda urgente'
        });
        console.assert(emailUrgent === 'urgente', 'Fallo clasificando urgente');
        console.log('✅ Clasificación urgente OK:', emailUrgent);

        const emailFactura = await classifyEmail({
            id: '2', threadId: '2', date: '', from: 'apple@bill.com', to: 'me',
            subject: 'Su factura de iCloud',
            snippet: '', body: 'Aquí tiene su invoice del mes'
        });
        console.assert(emailFactura === 'factura', 'Fallo clasificando factura');
        console.log('✅ Clasificación factura OK:', emailFactura);

        console.log('\\n--- Todos los tests completados ---');
    } catch (err: any) {
        console.error('❌ Error en tests de Email Manager:', err.message);
    }
}

runTests();
