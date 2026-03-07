import { analyzeCSV, detectAnomalies } from './index';

async function runTests() {
    console.log('--- Iniciando Tests de Data Analyzer ---');

    const csv = `id,name,age,salary
1,Alice,30,50000
2,Bob,35,60000
3,Charlie,28,45000
4,David,40,200000
5,Eve,,55000`;

    try {
        console.log('\\n[1] Probando analyzeCSV...');
        const result = await analyzeCSV(csv);
        console.assert(result.nullCount['age'] === 1, 'Conteos nulos fallaron');
        console.assert(result.stats['salary'].max === 200000, 'Max fallback failed');
        console.log('✅ CSV Analizado. Stats de Salary:', result.stats['salary']);

        console.log('\\n[2] Probando detectAnomalies...');
        const anomalies = await detectAnomalies(parseMock(csv), 'salary');
        console.log('✅ Anomalías de salario:', anomalies);

        console.log('\\n--- Todos los tests completados ---');
    } catch (err: any) {
        console.error('❌ Error en tests de Data Analyzer:', err.message);
    }
}

function parseMock(csvText: string): any[] {
    const lines = csvText.trim().split('\\n');
    const headers = lines[0].split(',');
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const obj: any = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = values[j];
        }
        data.push(obj);
    }
    return data;
}

runTests();
