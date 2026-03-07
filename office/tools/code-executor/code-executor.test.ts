import { executeCode } from './index';

async function runTests() {
    console.log('--- Iniciando Tests de Code Executor ---');

    try {
        console.log('\\n[1] Probando JS Básico...');
        const resJS = await executeCode('javascript', 'console.log("Hola Jarvis!");');
        console.assert(resJS.exit_code === 0, 'Falló ejecución JS');
        console.assert(resJS.stdout.includes('Hola Jarvis!'), 'Stdout no coincide');
        console.log('✅ JS Ejecutado con éxito:', resJS.stdout.trim());

        console.log('\\n[2] Probando Python Básico...');
        const resPy = await executeCode('python', 'print("Hola desde Python")');
        console.assert(resPy.exit_code === 0, 'Falló ejecución Python');
        console.assert(resPy.stdout.includes('Python'), 'Stdout de python falló');
        console.log('✅ Python Ejecutado con éxito:', resPy.stdout.trim());

        console.log('\\n[3] Probando Sandbox Restringido JS (fs.readFile)...');
        const resJsHack = await executeCode('javascript', 'const fs = require("fs"); console.log(fs.readFileSync("/etc/passwd"));');
        console.assert(resJsHack.exit_code === 1, 'JS Hacker no fue detenido');
        console.log('✅ Sandbox detuvo acceso a archivos:', resJsHack.stderr.split('\\n')[0]);

        console.log('\\n--- Todos los tests completados ---');
    } catch (err: any) {
        console.error('❌ Error en tests de Code Executor:', err.message);
    }
}

runTests();
