import { writeFile, readFile, listFiles, deleteFile, getFileUrl } from './index';

async function runTests() {
    console.log('--- Iniciando Tests de File Manager ---');
    const testFileName = `test_${Date.now()}.txt`;

    try {
        console.log('\\n[1] Probando writeFile...');
        const record = await writeFile(testFileName, 'Contenido de prueba de Jarvis File Manager');
        console.assert(record.filename === testFileName, 'El nombre no coincide');
        console.log('✅ Archivo subido y registrado:', record.filename);

        console.log('\\n[2] Probando readFile...');
        const content = await readFile(testFileName);
        console.assert(content.includes('Contenido de prueba'), 'El contenido no coincide');
        console.log('✅ Archivo leído correctamente. Largo:', content.length);

        console.log('\\n[3] Probando listFiles...');
        const list = await listFiles('test_');
        console.assert(list.length > 0, 'No se listó el archivo');
        console.log(`✅ Archivos listados con prefijo test_: ${list.length}`);

        console.log('\\n[4] Probando getFileUrl...');
        const url = await getFileUrl(testFileName);
        console.assert(url.includes('http'), 'URL inválida devuelta');
        console.log('✅ URL generada:', url);

        console.log('\\n[5] Probando deleteFile (mover a archive)...');
        await deleteFile(testFileName);
        console.log('✅ Archivo movido a archive exitosamente.');

        console.log('\\n--- Todos los tests completados ---');
    } catch (err: any) {
        console.error('❌ Error en tests de File Manager:', err.message);
    }
}

runTests();
