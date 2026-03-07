import { visitPage, extractData } from './index';

async function runTests() {
    console.log('--- Iniciando Tests de Web Browser ---');

    try {
        console.log('\\n[1] Probando visitPage...');
        const page = await visitPage('https://example.com');
        console.assert(page.title.includes('Example Domain'), 'El título de Example no coincide');
        console.log('✅ visitPage exitoso. Título:', page.title);

        console.log('\\n[2] Probando extractData (H1)...');
        const h1s = await extractData('https://example.com', 'h1');
        console.assert(h1s.length > 0 && h1s[0] === 'Example Domain', 'Extracción falló');
        console.log('✅ extractData exitoso. H1:', h1s[0]);

        console.log('\\n--- Todos los tests completados ---');
    } catch (err: any) {
        console.error('❌ Error en tests de Web Browser:', err.message);
    } finally {
        process.exit(0);
    }
}

runTests();
